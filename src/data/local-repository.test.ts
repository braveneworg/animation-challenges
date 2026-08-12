import { describe, expect, it } from 'vitest';

import { LocalProgressRepository } from '@/data/local-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import type { Attempt, Note } from '@/data/records';
import { attemptsKey, MemoryStorage, STORAGE_KEYS } from '@/data/storage';

const T0 = '2026-08-01T10:00:00.000Z';
const NOW = (): string => '2026-08-02T00:00:00.000Z';

function makeAttempt(id: string, challengeId: string, createdAt: string = T0): Attempt {
  return { id, challengeId, createdAt, passed: false, failures: [], durationMs: 1000 };
}

describe('LocalProgressRepository', () => {
  it('lists nothing from empty storage', async () => {
    const repo = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    expect(await repo.listProgress()).toEqual([]);
    expect(await repo.listAttempts('a/b')).toEqual([]);
    expect(await repo.listAllAttempts()).toEqual([]);
    expect(await repo.getNote('a/b')).toBeNull();
    expect(await repo.listNotes()).toEqual([]);
  });

  it('round-trips progress records and replaces by id', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalProgressRepository(storage, { now: NOW });
    const record = initialProgressRecord('css-transitions/hover-lift', T0);
    await repo.upsertProgress(record);
    await repo.upsertProgress(initialProgressRecord('waapi/bounce-in', T0));
    const updated = { ...record, attempts: 5, updatedAt: NOW() };
    await repo.upsertProgress(updated);
    const listed = await repo.listProgress();
    expect(listed).toHaveLength(2);
    expect(listed.find((entry) => entry.id === record.id)).toEqual(updated);
  });

  it('survives a fresh instance over the same storage (actually persisted)', async () => {
    const storage = new MemoryStorage();
    const first = new LocalProgressRepository(storage, { now: NOW });
    await first.upsertProgress(initialProgressRecord('a/b', T0));
    const second = new LocalProgressRepository(storage, { now: NOW });
    expect(await second.listProgress()).toHaveLength(1);
  });

  it('treats corrupt progress data as absent', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.progress, '{corrupt');
    const repo = new LocalProgressRepository(storage, { now: NOW });
    expect(await repo.listProgress()).toEqual([]);
  });

  it('stores attempts per challenge and is idempotent by attempt id', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalProgressRepository(storage, { now: NOW });
    await repo.addAttempt(makeAttempt('id-1', 'a/b'));
    await repo.addAttempt(makeAttempt('id-1', 'a/b'));
    await repo.addAttempt(makeAttempt('id-2', 'a/b'));
    await repo.addAttempt(makeAttempt('id-3', 'c/d'));
    expect(await repo.listAttempts('a/b')).toHaveLength(2);
    expect(await repo.listAttempts('c/d')).toHaveLength(1);
    expect(storage.getItem(attemptsKey('a/b'))).not.toBeNull();
    const all = await repo.listAllAttempts();
    expect(all.map((attempt) => attempt.id).sort()).toEqual(['id-1', 'id-2', 'id-3']);
  });

  it('lists per-challenge attempts sorted by createdAt (ties by id), same as listAllAttempts — not raw insertion order', async () => {
    const T_OLD = '2026-08-01T09:00:00.000Z';
    const T_MID = '2026-08-01T10:00:00.000Z';
    const T_NEW = '2026-08-01T11:00:00.000Z';
    const repo = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    // Inserted deliberately out of chronological order.
    await repo.addAttempt(makeAttempt('newest', 'a/b', T_NEW));
    await repo.addAttempt(makeAttempt('oldest', 'a/b', T_OLD));
    await repo.addAttempt(makeAttempt('z-tie', 'a/b', T_MID));
    await repo.addAttempt(makeAttempt('a-tie', 'a/b', T_MID));

    expect((await repo.listAttempts('a/b')).map((attempt) => attempt.id)).toEqual([
      'oldest',
      'a-tie',
      'z-tie',
      'newest',
    ]);
  });

  it('saves and lists notes keyed by challenge', async () => {
    const repo = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    const note: Note = { id: 'a/b', challengeId: 'a/b', body: 'remember transforms', updatedAt: T0 };
    await repo.saveNote(note);
    expect(await repo.getNote('a/b')).toEqual(note);
    expect(await repo.getNote('c/d')).toBeNull();
    expect(await repo.listNotes()).toEqual([note]);
  });

  it('creates a default profile once and keeps it stable', async () => {
    const repo = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    const created = await repo.getProfile();
    expect(created).toEqual({ id: 'local', displayName: 'Local user', createdAt: NOW() });
    expect(await repo.getProfile()).toEqual(created);
  });

  it('putProfile replaces the stored profile', async () => {
    const repo = new LocalProgressRepository(new MemoryStorage(), { now: NOW });
    const replacement = { id: 'local', displayName: 'Renamed', createdAt: T0 };
    await repo.putProfile(replacement);
    expect(await repo.getProfile()).toEqual(replacement);
  });
});
