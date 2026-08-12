import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from '@/data/envelope';
import { LocalProgressRepository } from '@/data/local-repository';
import { MirroredProgressRepository } from '@/data/mirrored-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import type { Attempt, Note, Profile, ProgressRecord } from '@/data/records';
import type { SyncableProgressStore } from '@/data/repository';
import { MemoryStorage, STORAGE_KEYS } from '@/data/storage';

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

function readDirtyProgress(storage: MemoryStorage): string[] {
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
