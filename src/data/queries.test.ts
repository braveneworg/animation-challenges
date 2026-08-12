import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { LocalProgressRepository } from '@/data/local-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import {
  attemptsQueryOptions,
  dataKeys,
  invalidateAllData,
  invalidateChallengeData,
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

/** Seeds every cache entry these tests care about, both for `MATCHING` and `OTHER` challenges. */
function seedChallengeCaches(client: QueryClient): void {
  client.setQueryData(dataKeys.progress(), []);
  client.setQueryData(dataKeys.attempts(MATCHING), []);
  client.setQueryData(dataKeys.note(MATCHING), null);
  client.setQueryData(dataKeys.attempts(OTHER), []);
  client.setQueryData(dataKeys.note(OTHER), null);
  client.setQueryData(dataKeys.profile(), { id: 'local', displayName: 'Local user', createdAt: T0 });
}

function isStale(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

const MATCHING = 'css-transitions/hover-lift';
const OTHER = 'waapi/bounce-in';

describe('invalidateChallengeData', () => {
  it('invalidates progress and exactly the matching challenge — a different challenge and profile stay fresh', async () => {
    const client = new QueryClient();
    seedChallengeCaches(client);

    await invalidateChallengeData(client, MATCHING);

    expect(isStale(client, dataKeys.progress())).toBe(true);
    expect(isStale(client, dataKeys.attempts(MATCHING))).toBe(true);
    expect(isStale(client, dataKeys.note(MATCHING))).toBe(true);
    expect(isStale(client, dataKeys.attempts(OTHER))).toBe(false);
    expect(isStale(client, dataKeys.note(OTHER))).toBe(false);
    expect(isStale(client, dataKeys.profile())).toBe(false);

    client.clear();
  });
});

describe('invalidateAllData', () => {
  it('invalidates every entry under ["data"], for every challenge, including profile', async () => {
    const client = new QueryClient();
    seedChallengeCaches(client);

    await invalidateAllData(client);

    expect(isStale(client, dataKeys.progress())).toBe(true);
    expect(isStale(client, dataKeys.attempts(MATCHING))).toBe(true);
    expect(isStale(client, dataKeys.note(MATCHING))).toBe(true);
    expect(isStale(client, dataKeys.attempts(OTHER))).toBe(true);
    expect(isStale(client, dataKeys.note(OTHER))).toBe(true);
    expect(isStale(client, dataKeys.profile())).toBe(true);

    client.clear();
  });
});
