import { z } from 'zod';

import { readEnvelope, writeEnvelope } from '@/data/envelope';
import { reconcileByUpdatedAt, unionById } from '@/data/reconcile';
import { parseWith, type Attempt, type Note, type Profile, type ProgressRecord } from '@/data/records';
import type { ProgressRepository, SyncableProgressStore } from '@/data/repository';
import { STORAGE_KEYS, type KeyValueStorage } from '@/data/storage';

export type SyncStatus = 'synced' | 'partial' | 'offline' | 'disabled';

export interface SyncResult {
  status: SyncStatus;
  pushed: number;
  pulled: number;
  errors: string[];
}

export interface MirroredRepositoryOptions {
  local: SyncableProgressStore;
  remote: SyncableProgressStore | null;
  storage: KeyValueStorage;
}

interface DirtyState {
  progress: string[];
  notes: string[];
}

type DirtyKind = keyof DirtyState;

const dirtyStateSchema = z.strictObject({ progress: z.array(z.string()), notes: z.array(z.string()) });

function emptyDirty(): DirtyState {
  return { progress: [], notes: [] };
}

function withDirtyKind(dirty: DirtyState, kind: DirtyKind, ids: string[]): DirtyState {
  return kind === 'progress' ? { progress: ids, notes: dirty.notes } : { progress: dirty.progress, notes: ids };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `current` minus `pushed` (successfully synced this round), union `failed` (still dirty). */
function mergeDirtyIds(current: readonly string[], pushed: readonly string[], failed: readonly string[]): string[] {
  const survivors = current.filter((id) => !pushed.includes(id));
  const merged = [...survivors];
  for (const id of failed) {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  }
  return merged;
}

/**
 * Runs `action` over `items` one at a time, in call order, via a `.reduce`-built promise
 * chain — not a `for`/`while` loop with an `await` in its body (`no-await-in-loop` is an
 * error in this repo's perf category). Sequencing matters here: several of these steps
 * read-modify-write a storage key that holds an entire collection (e.g. `STORAGE_KEYS.progress`
 * backs every progress record), so concurrent writes issued via `Promise.all` could race.
 */
function sequentialForEach<T>(items: readonly T[], action: (item: T) => Promise<void>): Promise<void> {
  return items.reduce<Promise<void>>((chain, item) => chain.then(() => action(item)), Promise.resolve());
}

/**
 * localStorage is the read source of truth; HTTP is a durable mirror (spec §7.2).
 * Mirror failures degrade silently to local-only (spec §3.4) and recover via sync().
 */
export class MirroredProgressRepository implements ProgressRepository {
  private readonly local: SyncableProgressStore;
  private readonly remote: SyncableProgressStore | null;
  private readonly storage: KeyValueStorage;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(options: MirroredRepositoryOptions) {
    this.local = options.local;
    this.remote = options.remote;
    this.storage = options.storage;
  }

  // Reads: local only. The server is never on a read path.
  listProgress(): Promise<ProgressRecord[]> {
    return this.local.listProgress();
  }

  listAttempts(challengeId: string): Promise<Attempt[]> {
    return this.local.listAttempts(challengeId);
  }

  getNote(challengeId: string): Promise<Note | null> {
    return this.local.getNote(challengeId);
  }

  getProfile(): Promise<Profile> {
    return this.local.getProfile();
  }

  // Writes: local first, then a fire-and-forget mirror write that can never reject the caller.
  async upsertProgress(rec: ProgressRecord): Promise<ProgressRecord> {
    const saved = await this.local.upsertProgress(rec);
    this.mirror('progress', rec.id, (remote) => remote.upsertProgress(rec));
    return saved;
  }

  async addAttempt(a: Attempt): Promise<Attempt> {
    const saved = await this.local.addAttempt(a);
    // Attempts are append-only; sync()'s union re-derives any missed push, so no dirty mark.
    this.mirror(null, null, (remote) => remote.addAttempt(a));
    return saved;
  }

  async saveNote(n: Note): Promise<Note> {
    const saved = await this.local.saveNote(n);
    this.mirror('notes', n.id, (remote) => remote.saveNote(n));
    return saved;
  }

  /** Awaits every in-flight mirror write — the deterministic seam for tests and unload. */
  async flush(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  async sync(): Promise<SyncResult> {
    const { remote } = this;
    if (remote === null) {
      return { status: 'disabled', pushed: 0, pulled: 0, errors: [] };
    }
    await this.flush();

    let remoteProgress: ProgressRecord[];
    let remoteAttempts: Attempt[];
    let remoteNotes: Note[];
    try {
      remoteProgress = await remote.listProgress();
      remoteAttempts = await remote.listAllAttempts();
      remoteNotes = await remote.listNotes();
    } catch (error) {
      // Server unreachable or serving garbage: change nothing, stay fully functional
      // on localStorage, retry from scratch on the next sync().
      return { status: 'offline', pushed: 0, pulled: 0, errors: [errorMessage(error)] };
    }

    const dirty = this.readDirty();
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;

    const progressPlan = reconcileByUpdatedAt(await this.local.listProgress(), remoteProgress, new Set(dirty.progress));
    await sequentialForEach(progressPlan.toWriteLocal, async (record) => {
      try {
        await this.local.upsertProgress(record);
        pulled += 1;
      } catch (error) {
        errors.push(`progress pull ${record.id}: ${errorMessage(error)}`);
      }
    });
    const pushedProgressIds: string[] = [];
    const stillDirtyProgress: string[] = [];
    await sequentialForEach(progressPlan.toPush, async (record) => {
      try {
        await remote.upsertProgress(record);
        pushed += 1;
        pushedProgressIds.push(record.id);
      } catch (error) {
        stillDirtyProgress.push(record.id);
        errors.push(`progress ${record.id}: ${errorMessage(error)}`);
      }
    });

    const notesPlan = reconcileByUpdatedAt(await this.local.listNotes(), remoteNotes, new Set(dirty.notes));
    await sequentialForEach(notesPlan.toWriteLocal, async (note) => {
      try {
        await this.local.saveNote(note);
        pulled += 1;
      } catch (error) {
        errors.push(`note pull ${note.id}: ${errorMessage(error)}`);
      }
    });
    const pushedNoteIds: string[] = [];
    const stillDirtyNotes: string[] = [];
    await sequentialForEach(notesPlan.toPush, async (note) => {
      try {
        await remote.saveNote(note);
        pushed += 1;
        pushedNoteIds.push(note.id);
      } catch (error) {
        stillDirtyNotes.push(note.id);
        errors.push(`note ${note.id}: ${errorMessage(error)}`);
      }
    });

    const attemptsPlan = unionById(await this.local.listAllAttempts(), remoteAttempts);
    await sequentialForEach(attemptsPlan.toWriteLocal, async (attempt) => {
      try {
        await this.local.addAttempt(attempt);
        pulled += 1;
      } catch (error) {
        errors.push(`attempt pull ${attempt.id}: ${errorMessage(error)}`);
      }
    });
    await sequentialForEach(attemptsPlan.toPush, async (attempt) => {
      try {
        await remote.addAttempt(attempt);
        pushed += 1;
      } catch (error) {
        errors.push(`attempt ${attempt.id}: ${errorMessage(error)}`);
      }
    });

    // Profile: local is authoritative for the single implicit user; mirror it up. This is
    // unconditional housekeeping, not a data sync outcome, so it does NOT add to `pushed` —
    // the plan's contract doesn't pin `pushed`'s semantics explicitly, so this follows the
    // simplest correct reading: `pushed` counts the reconciled progress/notes/attempts this
    // sync actually pushed, not every remote write sync() happens to make.
    try {
      await remote.putProfile(await this.local.getProfile());
    } catch (error) {
      errors.push(`profile: ${errorMessage(error)}`);
    }

    this.finalizeDirty(pushedProgressIds, stillDirtyProgress, pushedNoteIds, stillDirtyNotes);

    return { status: errors.length === 0 ? 'synced' : 'partial', pushed, pulled, errors };
  }

  /**
   * Merges this sync's outcome into whatever dirty state exists RIGHT NOW, instead of
   * blindly overwriting it with the outcome computed from this sync's start-of-run
   * snapshot. A write can land WHILE this sync is still in flight (its own mirror attempt
   * failing after this sync already captured `dirty` and its local snapshots) — that
   * concurrent mark must survive finalization: the binding rule (spec §7.2) is "a failure
   * marks the record dirty," full stop, not "unless a sync happens to be running."
   *
   * final = (dirty state read right now) MINUS (ids THIS sync successfully pushed)
   *         UNION (ids that failed THIS sync's push)
   *
   * Known residual (accepted, not fixed here): a record this sync itself pushed
   * successfully AND that a concurrent write re-marks dirty between that push and this
   * finalization step still loses that later mark — the MINUS step above can't distinguish
   * "still dirty from before my push" from "dirty again already, for a different reason"
   * without per-write generation tracking. That is a larger design change, deferred.
   */
  /**
   * Guarded like `markDirty`/`clearDirty`: this write is unconditional on every `sync()` call,
   * and in production `local` and this mirror's own dirty-tracking `storage` are frequently the
   * SAME backing store (see `createAppRepository`) — so a real quota-exceeded error can hit this
   * write too, not just the per-item pull writes above. `sync()` must never throw regardless.
   */
  private finalizeDirty(
    pushedProgress: readonly string[],
    failedProgress: readonly string[],
    pushedNotes: readonly string[],
    failedNotes: readonly string[],
  ): void {
    try {
      const current = this.readDirty();
      this.writeDirty({
        progress: mergeDirtyIds(current.progress, pushedProgress, failedProgress),
        notes: mergeDirtyIds(current.notes, pushedNotes, failedNotes),
      });
    } catch {
      // Dirty bookkeeping is best-effort (spec §3.4): a storage failure here degrades
      // silently rather than rejecting sync()'s promise.
    }
  }

  private mirror(
    kind: DirtyKind | null,
    id: string | null,
    op: (remote: SyncableProgressStore) => Promise<unknown>,
  ): void {
    const { remote } = this;
    if (remote === null) {
      return;
    }
    // `Promise.resolve().then(...)` (rather than calling `op(remote)` directly) makes sure a
    // *synchronous* throw from `op` degrades exactly like a rejected promise — no mirror error
    // of any shape may ever escape this fire-and-forget path.
    const task = Promise.resolve()
      .then(() => op(remote))
      .then(
        () => {
          if (kind !== null && id !== null) {
            this.clearDirty(kind, id);
          }
          return undefined;
        },
        () => {
          if (kind !== null && id !== null) {
            this.markDirty(kind, id);
          }
          return undefined;
        },
      );
    this.inFlight.add(task);
    void task.finally(() => {
      this.inFlight.delete(task);
    });
  }

  private readDirty(): DirtyState {
    return (
      readEnvelope(this.storage.getItem(STORAGE_KEYS.dirty), (input) =>
        parseWith<DirtyState>(dirtyStateSchema, input),
      ) ?? emptyDirty()
    );
  }

  private writeDirty(dirty: DirtyState): void {
    this.storage.setItem(STORAGE_KEYS.dirty, writeEnvelope(dirty));
  }

  /**
   * Called only from `mirror()`'s fire-and-forget settle handlers, which have no caller to
   * report a rejection to — a storage failure here must degrade silently (best-effort mirror
   * bookkeeping, spec §3.4), never reject the chain and surface as an unhandled rejection.
   */
  private markDirty(kind: DirtyKind, id: string): void {
    try {
      const dirty = this.readDirty();
      if (!dirty[kind].includes(id)) {
        this.writeDirty(withDirtyKind(dirty, kind, [...dirty[kind], id]));
      }
    } catch {
      // See docstring: swallow, don't propagate into the fire-and-forget mirror chain.
    }
  }

  /** See `markDirty`'s docstring — same fire-and-forget rationale. */
  private clearDirty(kind: DirtyKind, id: string): void {
    try {
      const dirty = this.readDirty();
      if (dirty[kind].includes(id)) {
        this.writeDirty(
          withDirtyKind(
            dirty,
            kind,
            dirty[kind].filter((existing) => existing !== id),
          ),
        );
      }
    } catch {
      // See docstring: swallow, don't propagate into the fire-and-forget mirror chain.
    }
  }
}
