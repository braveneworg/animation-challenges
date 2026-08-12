import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from '@/data/envelope';
import { LocalProgressRepository } from '@/data/local-repository';
import { MirroredProgressRepository } from '@/data/mirrored-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import type { Attempt, Note, Profile, ProgressRecord } from '@/data/records';
import type { SyncableProgressStore } from '@/data/repository';
import { MemoryStorage, STORAGE_KEYS, type KeyValueStorage } from '@/data/storage';

/**
 * `src/**` type-checks under tsconfig.app.json (browser lib, no `@types/node` in `types`), but
 * the `unit` vitest project this file belongs to actually executes under Node (vitest.config.ts:
 * `environment: 'node'`) — real `process.on('unhandledRejection', ...)` is exactly what's needed
 * to pin the fix below. Declared locally rather than widening the app tsconfig's `types`.
 */
declare const process: {
  on: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void;
  off: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void;
};

const T_OLD = '2026-08-01T10:00:00.000Z';
const T_NEW = '2026-08-02T10:00:00.000Z';
const NOW = (): string => '2026-08-03T00:00:00.000Z';

/** In-memory remote with per-method failure switches. */
class FakeRemoteStore implements SyncableProgressStore {
  progress = new Map<string, ProgressRecord>();
  attempts = new Map<string, Attempt>();
  notes = new Map<string, Note>();
  profile: Profile | null = null;
  failUpserts = false;
  failPulls = false;
  upsertCalls = 0;
  readCalls = 0;

  private guard(kind: 'pull' | 'upsert'): void {
    if (kind === 'pull' && this.failPulls) throw new Error('remote pull unavailable');
    if (kind === 'upsert' && this.failUpserts) throw new Error('remote write unavailable');
  }

  listProgress(): Promise<ProgressRecord[]> {
    this.readCalls += 1;
    this.guard('pull');
    return Promise.resolve([...this.progress.values()]);
  }

  upsertProgress(rec: ProgressRecord): Promise<ProgressRecord> {
    this.upsertCalls += 1;
    this.guard('upsert');
    this.progress.set(rec.id, rec);
    return Promise.resolve(rec);
  }

  listAttempts(challengeId: string): Promise<Attempt[]> {
    this.readCalls += 1;
    this.guard('pull');
    return Promise.resolve([...this.attempts.values()].filter((attempt) => attempt.challengeId === challengeId));
  }

  addAttempt(a: Attempt): Promise<Attempt> {
    this.guard('upsert');
    this.attempts.set(a.id, a);
    return Promise.resolve(a);
  }

  listAllAttempts(): Promise<Attempt[]> {
    this.readCalls += 1;
    this.guard('pull');
    return Promise.resolve([...this.attempts.values()]);
  }

  getNote(challengeId: string): Promise<Note | null> {
    this.readCalls += 1;
    this.guard('pull');
    return Promise.resolve(this.notes.get(challengeId) ?? null);
  }

  saveNote(n: Note): Promise<Note> {
    this.guard('upsert');
    this.notes.set(n.id, n);
    return Promise.resolve(n);
  }

  listNotes(): Promise<Note[]> {
    this.readCalls += 1;
    this.guard('pull');
    return Promise.resolve([...this.notes.values()]);
  }

  getProfile(): Promise<Profile> {
    this.readCalls += 1;
    this.guard('pull');
    if (this.profile === null) throw new Error('no remote profile');
    return Promise.resolve(this.profile);
  }

  putProfile(profile: Profile): Promise<Profile> {
    this.guard('upsert');
    this.profile = profile;
    return Promise.resolve(profile);
  }
}

/** A KeyValueStorage whose `setItem` can be switched on to throw on demand — pins realistic
 * `localStorage.setItem` QuotaExceededError behavior without touching real browser storage. */
class FakeStorage implements KeyValueStorage {
  private readonly store = new Map<string, string>();
  failSetItem = false;
  /** When set, only `setItem` calls whose key includes this substring throw. */
  failSetItemForKeyIncluding: string | null = null;

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const shouldFail =
      this.failSetItem || (this.failSetItemForKeyIncluding !== null && key.includes(this.failSetItemForKeyIncluding));
    if (shouldFail) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  keys(): readonly string[] {
    return [...this.store.keys()];
  }
}

interface Fixture {
  storage: MemoryStorage;
  local: LocalProgressRepository;
  remote: FakeRemoteStore;
  mirrored: MirroredProgressRepository;
}

function makeFixture(): Fixture {
  const storage = new MemoryStorage();
  const local = new LocalProgressRepository(storage, { now: NOW });
  const remote = new FakeRemoteStore();
  const mirrored = new MirroredProgressRepository({ local, remote, storage });
  return { storage, local, remote, mirrored };
}

function readDirtyProgress(storage: KeyValueStorage): string[] {
  const raw = storage.getItem(STORAGE_KEYS.dirty);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'schemaVersion' in parsed &&
    parsed.schemaVersion === CURRENT_SCHEMA_VERSION &&
    'data' in parsed &&
    typeof parsed.data === 'object' &&
    parsed.data !== null &&
    'progress' in parsed.data &&
    Array.isArray(parsed.data.progress)
  ) {
    return parsed.data.progress.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}

/** Same shape as `readDirtyProgress`, reading the `notes` field of the dirty envelope instead. */
function readDirtyNotes(storage: KeyValueStorage): string[] {
  const raw = storage.getItem(STORAGE_KEYS.dirty);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'schemaVersion' in parsed &&
    parsed.schemaVersion === CURRENT_SCHEMA_VERSION &&
    'data' in parsed &&
    typeof parsed.data === 'object' &&
    parsed.data !== null &&
    'notes' in parsed.data &&
    Array.isArray(parsed.data.notes)
  ) {
    return parsed.data.notes.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}

/** Resolves once `signal()` is called, and lets the caller pause an in-flight async op until `release()` runs. */
function makeRendezvous(): { signal: () => void; reached: Promise<void>; release: () => void; gate: Promise<void> } {
  let signal: (() => void) | undefined;
  let release: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => {
    signal = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (signal === undefined || release === undefined) {
    throw new Error('Promise executors must run synchronously');
  }
  return { signal, reached, release, gate };
}

describe('reads', () => {
  it('never touch the remote', async () => {
    const { mirrored, remote } = makeFixture();
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.flush();
    await mirrored.listProgress();
    await mirrored.listAttempts('a/b');
    await mirrored.getNote('a/b');
    await mirrored.getProfile();
    expect(remote.readCalls).toBe(0);
  });
});

describe('writes', () => {
  it('land locally and mirror to the remote', async () => {
    const { mirrored, local, remote } = makeFixture();
    const record = initialProgressRecord('a/b', T_OLD);
    await mirrored.upsertProgress(record);
    await mirrored.flush();
    expect(await local.listProgress()).toEqual([record]);
    expect(remote.progress.get('a/b')).toEqual(record);
  });

  it('succeed locally and mark dirty when the mirror fails — no throw', async () => {
    const { mirrored, local, remote, storage } = makeFixture();
    remote.failUpserts = true;
    const record = initialProgressRecord('a/b', T_OLD);
    const result = await mirrored.upsertProgress(record);
    await mirrored.flush();
    expect(result).toEqual(record);
    expect(await local.listProgress()).toEqual([record]);
    expect(readDirtyProgress(storage)).toEqual(['a/b']);
  });

  it('clear the dirty mark on the next successful mirror write of that record', async () => {
    const { mirrored, remote, storage } = makeFixture();
    remote.failUpserts = true;
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.flush();
    expect(readDirtyProgress(storage)).toEqual(['a/b']);
    remote.failUpserts = false;
    await mirrored.upsertProgress({ ...initialProgressRecord('a/b', T_OLD), attempts: 1, updatedAt: T_NEW });
    await mirrored.flush();
    expect(readDirtyProgress(storage)).toEqual([]);
  });

  it('succeed locally and mark the note dirty when the mirror fails — no throw', async () => {
    const { mirrored, local, remote, storage } = makeFixture();
    remote.failUpserts = true;
    const note: Note = { id: 'a/b', challengeId: 'a/b', body: 'local draft', updatedAt: T_OLD };
    const result = await mirrored.saveNote(note);
    await mirrored.flush();
    expect(result).toEqual(note);
    expect(await local.getNote('a/b')).toEqual(note);
    expect(readDirtyNotes(storage)).toEqual(['a/b']);
  });

  it('clear the note dirty mark on the next successful mirror write of that note', async () => {
    const { mirrored, remote, storage } = makeFixture();
    remote.failUpserts = true;
    const note: Note = { id: 'a/b', challengeId: 'a/b', body: 'local draft', updatedAt: T_OLD };
    await mirrored.saveNote(note);
    await mirrored.flush();
    expect(readDirtyNotes(storage)).toEqual(['a/b']);
    remote.failUpserts = false;
    await mirrored.saveNote({ ...note, body: 'final draft', updatedAt: T_NEW });
    await mirrored.flush();
    expect(readDirtyNotes(storage)).toEqual([]);
  });
});

describe('sync', () => {
  it('reports disabled when there is no remote', async () => {
    const storage = new MemoryStorage();
    const local = new LocalProgressRepository(storage, { now: NOW });
    const mirrored = new MirroredProgressRepository({ local, remote: null, storage });
    expect(await mirrored.sync()).toEqual({ status: 'disabled', pushed: 0, pulled: 0, errors: [] });
  });

  it('reports offline and touches nothing local when the pull fails', async () => {
    const { mirrored, local, remote } = makeFixture();
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.flush();
    remote.failPulls = true;
    const result = await mirrored.sync();
    expect(result.status).toBe('offline');
    expect(result.errors).toHaveLength(1);
    expect(await local.listProgress()).toEqual([initialProgressRecord('a/b', T_OLD)]);
  });

  it('counts pushed data records only — the unconditional profile push is not a data sync', async () => {
    // sync() always mirrors the local profile up regardless of whether anything else needed
    // syncing; that housekeeping push must not inflate `pushed`, which Plan 05 will surface as
    // "N items synced." One dirty progress record pushed successfully should read as pushed: 1.
    const { mirrored, remote, storage } = makeFixture();
    remote.failUpserts = true;
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.flush();
    expect(readDirtyProgress(storage)).toEqual(['a/b']);
    remote.failUpserts = false;

    const result = await mirrored.sync();

    expect(result.status).toBe('synced');
    expect(remote.profile).not.toBeNull(); // the profile really was pushed...
    expect(result.pushed).toBe(1); // ...but doesn't count toward `pushed`.
  });

  it('pushes dirty records, pulls newer remote records, and unions attempts', async () => {
    const { mirrored, local, remote, storage } = makeFixture();
    // Local write that never reached the server:
    remote.failUpserts = true;
    const dirtyRecord = { ...initialProgressRecord('a/b', T_OLD), attempts: 2 };
    await mirrored.upsertProgress(dirtyRecord);
    await mirrored.flush();
    remote.failUpserts = false;
    // Remote knows a record and an attempt local has never seen:
    const remoteOnly: ProgressRecord = { ...initialProgressRecord('c/d', T_NEW), status: 'attempted', attempts: 1 };
    remote.progress.set('c/d', remoteOnly);
    const remoteAttempt: Attempt = {
      id: 'ra-1',
      challengeId: 'c/d',
      createdAt: T_NEW,
      passed: false,
      failures: [],
      durationMs: 9,
    };
    remote.attempts.set('ra-1', remoteAttempt);
    // Local attempt the server has never seen:
    const localAttempt: Attempt = {
      id: 'la-1',
      challengeId: 'a/b',
      createdAt: T_OLD,
      passed: false,
      failures: [],
      durationMs: 5,
    };
    await mirrored.addAttempt(localAttempt);
    await mirrored.flush();
    remote.attempts.delete('la-1');

    const result = await mirrored.sync();

    expect(result.status).toBe('synced');
    expect(remote.progress.get('a/b')).toEqual(dirtyRecord);
    expect(await local.listProgress()).toContainEqual(remoteOnly);
    expect(remote.attempts.get('la-1')).toEqual(localAttempt);
    expect(await local.listAttempts('c/d')).toEqual([remoteAttempt]);
    expect(readDirtyProgress(storage)).toEqual([]);
    expect(remote.profile).not.toBeNull();
  });

  it('pushes dirty notes, pulls a remote-only note, and lets the newest updatedAt win', async () => {
    const { mirrored, local, remote, storage } = makeFixture();
    // Local note that never reached the server:
    remote.failUpserts = true;
    const dirtyNote: Note = { id: 'a/b', challengeId: 'a/b', body: 'local draft, never synced', updatedAt: T_OLD };
    await mirrored.saveNote(dirtyNote);
    await mirrored.flush();
    remote.failUpserts = false;

    // Remote knows a note local has never seen:
    const remoteOnlyNote: Note = { id: 'c/d', challengeId: 'c/d', body: 'remote only', updatedAt: T_NEW };
    remote.notes.set('c/d', remoteOnlyNote);

    // Both sides know 'e/f'; the mirror write below lands the stale local copy on the
    // server, then the server independently receives a newer edit from elsewhere —
    // reconcile must prefer that newer remote copy over the (not dirty) stale local one.
    const localStaleNote: Note = { id: 'e/f', challengeId: 'e/f', body: 'stale local', updatedAt: T_OLD };
    await mirrored.saveNote(localStaleNote);
    await mirrored.flush();
    const remoteFreshNote: Note = { id: 'e/f', challengeId: 'e/f', body: 'fresh remote', updatedAt: T_NEW };
    remote.notes.set('e/f', remoteFreshNote);

    const result = await mirrored.sync();

    expect(result.status).toBe('synced');
    expect(remote.notes.get('a/b')).toEqual(dirtyNote);
    expect(await local.getNote('c/d')).toEqual(remoteOnlyNote);
    expect(await local.getNote('e/f')).toEqual(remoteFreshNote);
    expect(readDirtyNotes(storage)).toEqual([]);
  });

  it('keeps exactly the failed pushes dirty on a partial failure mid-sync', async () => {
    const { mirrored, remote, storage } = makeFixture();
    remote.failUpserts = true;
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.upsertProgress(initialProgressRecord('c/d', T_OLD));
    await mirrored.flush();
    expect(readDirtyProgress(storage).sort()).toEqual(['a/b', 'c/d']);
    // The server accepts exactly one write, then fails again:
    let allowed = 1;
    remote.failUpserts = false;
    const realUpsert = remote.upsertProgress.bind(remote);
    remote.upsertProgress = (rec: ProgressRecord): Promise<ProgressRecord> => {
      if (allowed === 0) return Promise.reject(new Error('server died mid-sync'));
      allowed -= 1;
      return realUpsert(rec);
    };

    const result = await mirrored.sync();

    expect(result.status).toBe('partial');
    expect(result.errors).toHaveLength(1);
    expect(readDirtyProgress(storage)).toHaveLength(1);
    expect(result.pushed).toBeGreaterThanOrEqual(1);
  });

  it('marks dirty a push failure for a record that was never dirty-tracked to begin with', async () => {
    // Reconcile can decide to push a record purely because local is timestamp-newer than
    // remote, with no prior dirty mark at all (e.g. seeded directly rather than through a
    // mirrored write). If THAT push fails during sync, the record must come out of this
    // sync dirty — finalization can't rely on "it was already in the dirty set," because
    // it wasn't.
    const { mirrored, local, remote, storage } = makeFixture();
    const remoteRecord = initialProgressRecord('a/b', T_OLD);
    remote.progress.set('a/b', remoteRecord);
    const newerLocalRecord = { ...remoteRecord, attempts: 1, updatedAt: T_NEW };
    await local.upsertProgress(newerLocalRecord); // bypasses the mirror: never dirty-tracked
    expect(readDirtyProgress(storage)).toEqual([]);

    remote.failUpserts = true;
    const result = await mirrored.sync();

    expect(result.status).toBe('partial');
    expect(readDirtyProgress(storage)).toEqual(['a/b']);
  });

  it('recovers on the next sync after the server returns', async () => {
    const { mirrored, remote, storage } = makeFixture();
    remote.failUpserts = true;
    remote.failPulls = true;
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.flush();
    expect((await mirrored.sync()).status).toBe('offline');
    remote.failUpserts = false;
    remote.failPulls = false;
    expect((await mirrored.sync()).status).toBe('synced');
    expect(remote.progress.get('a/b')).toEqual(initialProgressRecord('a/b', T_OLD));
    expect(readDirtyProgress(storage)).toEqual([]);
  });
});

describe('sync finalization races', () => {
  it('preserves a dirty mark set by a concurrent write while a sync is still in flight', async () => {
    const { mirrored, remote, storage } = makeFixture();
    // Gate the LAST remote call sync() makes (the profile push) so every other stage —
    // both pulls, and the progress/notes/attempts plans and their pushes — has already run
    // to completion using a snapshot taken before the concurrent write below ever happens.
    const rendezvous = makeRendezvous();
    const originalPutProfile = remote.putProfile.bind(remote);
    remote.putProfile = (profile: Profile): Promise<Profile> => {
      rendezvous.signal();
      return rendezvous.gate.then(() => originalPutProfile(profile));
    };

    const syncPromise = mirrored.sync();
    await rendezvous.reached; // sync() is now suspended exactly at the gated profile push.

    // A write lands WHILE sync is in flight, for a record sync's already-computed plans
    // never saw. Its mirror fails, so it must be marked dirty — and that mark must survive
    // sync()'s finalization, per the binding rule "a failure marks the record dirty."
    remote.failUpserts = true;
    await mirrored.upsertProgress(initialProgressRecord('x/y', T_OLD));
    await mirrored.flush();
    remote.failUpserts = false;

    rendezvous.release();
    const result = await syncPromise;

    expect(result.status).toBe('synced');
    expect(readDirtyProgress(storage)).toEqual(['x/y']);

    // Recovery is just the next sync() call — the surviving mark gets pushed and cleared.
    const secondResult = await mirrored.sync();
    expect(secondResult.status).toBe('synced');
    expect(remote.progress.get('x/y')).toEqual(initialProgressRecord('x/y', T_OLD));
    expect(readDirtyProgress(storage)).toEqual([]);
  });
});

describe('sync() never throws on a local storage failure', () => {
  it('degrades to partial (not a rejection) when writing a pulled progress record locally fails', async () => {
    // localStorage.setItem realistically throws QuotaExceededError; a pull-side local write
    // (remote -> local) hitting that must not take the whole sync() down with it.
    const localStorage = new FakeStorage();
    const local = new LocalProgressRepository(localStorage, { now: NOW });
    await local.getProfile(); // materialize the default profile before writes start failing
    const remote = new FakeRemoteStore();
    const remoteOnly = initialProgressRecord('c/d', T_NEW);
    remote.progress.set('c/d', remoteOnly);
    const mirrored = new MirroredProgressRepository({ local, remote, storage: new MemoryStorage() });

    localStorage.failSetItem = true;
    const result = await mirrored.sync();

    expect(result.status).toBe('partial');
    expect(result.errors.some((message) => message.includes('c/d'))).toBe(true);
    expect(result.pulled).toBe(0);
    // The write never landed (storage still throwing) — confirmed via a non-failing reader
    // path: listProgress() only reads, so it works even mid-quota-exceeded.
    expect(await local.listProgress()).toEqual([]);
  });

  it('degrades to partial when writing a pulled note locally fails', async () => {
    const localStorage = new FakeStorage();
    const local = new LocalProgressRepository(localStorage, { now: NOW });
    await local.getProfile();
    const remote = new FakeRemoteStore();
    const remoteOnlyNote: Note = { id: 'c/d', challengeId: 'c/d', body: 'remote only', updatedAt: T_NEW };
    remote.notes.set('c/d', remoteOnlyNote);
    const mirrored = new MirroredProgressRepository({ local, remote, storage: new MemoryStorage() });

    localStorage.failSetItem = true;
    const result = await mirrored.sync();

    expect(result.status).toBe('partial');
    expect(result.errors.some((message) => message.includes('c/d'))).toBe(true);
    expect(await local.listNotes()).toEqual([]);
  });

  it('degrades to partial when writing a pulled attempt locally fails, without discarding earlier progress', async () => {
    const localStorage = new FakeStorage();
    const local = new LocalProgressRepository(localStorage, { now: NOW });
    await local.getProfile();
    const remote = new FakeRemoteStore();
    const remoteOnlyProgress = initialProgressRecord('c/d', T_NEW);
    remote.progress.set('c/d', remoteOnlyProgress);
    const remoteAttempt: Attempt = {
      id: 'ra-1',
      challengeId: 'c/d',
      createdAt: T_NEW,
      passed: false,
      failures: [],
      durationMs: 9,
    };
    remote.attempts.set('ra-1', remoteAttempt);
    const mirrored = new MirroredProgressRepository({ local, remote, storage: new MemoryStorage() });

    // Progress records write successfully; only the attempts collection key fails, proving a
    // single item's failure doesn't discard the sync's other, already-completed local writes.
    localStorage.failSetItemForKeyIncluding = 'attempts';

    const result = await mirrored.sync();

    expect(result.status).toBe('partial');
    expect(result.errors.some((message) => message.includes('ra-1'))).toBe(true);
    expect(await local.listProgress()).toContainEqual(remoteOnlyProgress);
    expect(await local.listAttempts('c/d')).toEqual([]);
  });

  it('finalizing dirty bookkeeping through a failing storage still resolves sync() without throwing', async () => {
    // finalizeDirty's write is unconditional on every sync() call, and in production `local`
    // and the mirror's own dirty-tracking `storage` are frequently the SAME backing storage
    // (see createAppRepository) — so a real quota-exceeded error hits this write too, not just
    // the two call sites above. Guarding it is still "dirty bookkeeping degrading silently."
    const local = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    const remote = new FakeRemoteStore();
    remote.profile = await local.getProfile();
    const dirtyStorage = new FakeStorage();
    dirtyStorage.failSetItem = true;
    const mirrored = new MirroredProgressRepository({ local, remote, storage: dirtyStorage });

    await expect(mirrored.sync()).resolves.toEqual(
      expect.objectContaining({ status: expect.stringMatching(/^(synced|partial)$/) }),
    );
  });
});

describe('mirror() settle handlers never produce an unhandled rejection', () => {
  it('a storage failure while marking a failed mirror write dirty is swallowed, and the caller promise still resolves', async () => {
    const dirtyStorage = new FakeStorage();
    dirtyStorage.failSetItem = true; // markDirty's writeDirty will throw every time
    const local = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    const remote = new FakeRemoteStore();
    remote.failUpserts = true; // forces mirror()'s error branch, which calls markDirty
    const mirrored = new MirroredProgressRepository({ local, remote, storage: dirtyStorage });

    const rejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      const saved = await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
      await mirrored.flush();
      // Give any already-scheduled unhandledRejection event a turn to fire before asserting.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(saved).toEqual(initialProgressRecord('a/b', T_OLD));
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
    expect(rejections).toEqual([]);
  });

  it('a storage failure while clearing a dirty mark on mirror success is swallowed, with no unhandled rejection', async () => {
    const dirtyStorage = new FakeStorage();
    const local = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    const remote = new FakeRemoteStore();
    const mirrored = new MirroredProgressRepository({ local, remote, storage: dirtyStorage });

    // Mark 'a/b' dirty first (mirror failure), then let the storage start failing before a
    // second, successful mirror write tries to clear that mark.
    remote.failUpserts = true;
    await mirrored.upsertProgress(initialProgressRecord('a/b', T_OLD));
    await mirrored.flush();
    expect(readDirtyProgress(dirtyStorage)).toEqual(['a/b']);

    remote.failUpserts = false;
    dirtyStorage.failSetItem = true;

    const rejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      const saved = await mirrored.upsertProgress({
        ...initialProgressRecord('a/b', T_OLD),
        attempts: 1,
        updatedAt: T_NEW,
      });
      await mirrored.flush();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(saved.attempts).toBe(1);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
    expect(rejections).toEqual([]);
  });
});
