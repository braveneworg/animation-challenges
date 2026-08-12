import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { LocalProgressRepository } from '@/data/local-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import {
  attemptsQueryOptions,
  dataKeys,
  noteQueryOptions,
  profileQueryOptions,
  progressQueryOptions,
} from '@/data/queries';
import { MemoryStorage } from '@/data/storage';

const T0 = '2026-08-01T10:00:00.000Z';

describe('dataKeys', () => {
  it('are namespaced under ["data"] and parameterized by challenge', () => {
    expect(dataKeys.progress()).toEqual(['data', 'progress']);
    expect(dataKeys.attempts('a/b')).toEqual(['data', 'attempts', 'a/b']);
    expect(dataKeys.note('a/b')).toEqual(['data', 'note', 'a/b']);
    expect(dataKeys.profile()).toEqual(['data', 'profile']);
  });
});

describe('queryOptions factories', () => {
  it('fetch through the repository with the right keys', async () => {
    const repo = new LocalProgressRepository(new MemoryStorage(), { now: () => T0 });
    await repo.upsertProgress(initialProgressRecord('a/b', T0));
    const client = new QueryClient();
    expect(await client.fetchQuery(progressQueryOptions(repo))).toEqual([initialProgressRecord('a/b', T0)]);
    expect(await client.fetchQuery(attemptsQueryOptions(repo, 'a/b'))).toEqual([]);
    expect(await client.fetchQuery(noteQueryOptions(repo, 'a/b'))).toBeNull();
    expect((await client.fetchQuery(profileQueryOptions(repo))).id).toBe('local');
    expect(client.getQueryData(dataKeys.progress())).toEqual([initialProgressRecord('a/b', T0)]);
    client.clear();
  });
});
