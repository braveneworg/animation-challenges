import { describe, expect, it } from 'vitest';

import { createAppRepository } from '@/data/app-repository';
import type { FetchLike } from '@/data/http-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import { MemoryStorage } from '@/data/storage';

const T0 = '2026-08-01T10:00:00.000Z';

describe('createAppRepository', () => {
  it('with an empty apiBaseUrl runs local-only and reports sync disabled', async () => {
    const repo = createAppRepository({ apiBaseUrl: '', storage: new MemoryStorage(), now: () => T0 });
    await repo.upsertProgress(initialProgressRecord('a/b', T0));
    await repo.flush();
    expect(await repo.listProgress()).toEqual([initialProgressRecord('a/b', T0)]);
    expect((await repo.sync()).status).toBe('disabled');
  });

  it('with a base URL and an unreachable server degrades to offline, keeping data local', async () => {
    const failingFetch: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'));
    const repo = createAppRepository({
      apiBaseUrl: 'http://localhost:3001',
      storage: new MemoryStorage(),
      fetchFn: failingFetch,
      now: () => T0,
    });
    await repo.upsertProgress(initialProgressRecord('a/b', T0));
    await repo.flush();
    expect(await repo.listProgress()).toEqual([initialProgressRecord('a/b', T0)]);
    expect((await repo.sync()).status).toBe('offline');
  });
});
