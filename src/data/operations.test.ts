import { describe, expect, it } from 'vitest';

import { LocalProgressRepository } from '@/data/local-repository';
import { recordClear, recordHintRevealed, recordSolutionViewed, recordSubmitOutcome } from '@/data/operations';
import { MemoryStorage } from '@/data/storage';

const T0 = '2026-08-01T10:00:00.000Z';
const CHALLENGE_ID = 'css-transitions/hover-lift';
const OPTS = { now: (): string => T0, createId: (): string => 'fixed-attempt-id' };

function makeRepo(): LocalProgressRepository {
  return new LocalProgressRepository(new MemoryStorage(), { now: () => T0 });
}

describe('recordSubmitOutcome', () => {
  it('creates the attempt and the first progress record together', async () => {
    const repo = makeRepo();
    const { attempt, progress } = await recordSubmitOutcome(
      repo,
      { challengeId: CHALLENGE_ID, passed: false, failures: [{ message: 'no lift' }], durationMs: 900 },
      OPTS,
    );
    expect(attempt).toEqual({
      id: 'fixed-attempt-id',
      challengeId: CHALLENGE_ID,
      createdAt: T0,
      passed: false,
      failures: [{ message: 'no lift' }],
      durationMs: 900,
    });
    expect(progress.status).toBe('attempted');
    expect(progress.attempts).toBe(1);
    expect(await repo.listAttempts(CHALLENGE_ID)).toEqual([attempt]);
    expect(await repo.listProgress()).toEqual([progress]);
  });

  it('applies the solve transition on an existing record', async () => {
    const repo = makeRepo();
    await recordSubmitOutcome(repo, { challengeId: CHALLENGE_ID, passed: false, failures: [], durationMs: 1 }, OPTS);
    const second = await recordSubmitOutcome(
      repo,
      { challengeId: CHALLENGE_ID, passed: true, failures: [], durationMs: 2 },
      { ...OPTS, createId: () => 'second-attempt-id' },
    );
    expect(second.progress.status).toBe('solved');
    expect(second.progress.solveQuality).toBe('clean');
    expect(second.progress.attempts).toBe(2);
  });
});

describe('the other operations', () => {
  it('recordHintRevealed and recordSolutionViewed update and persist the record', async () => {
    const repo = makeRepo();
    const hinted = await recordHintRevealed(repo, CHALLENGE_ID, OPTS);
    expect(hinted.hintsRevealed).toBe(1);
    const viewed = await recordSolutionViewed(repo, CHALLENGE_ID, OPTS);
    expect(viewed.viewedSolutionAt).toBe(T0);
    expect(await repo.listProgress()).toEqual([viewed]);
  });

  it('recordClear resets the record through the Clear transition', async () => {
    const repo = makeRepo();
    await recordSubmitOutcome(repo, { challengeId: CHALLENGE_ID, passed: true, failures: [], durationMs: 1 }, OPTS);
    const cleared = await recordClear(repo, CHALLENGE_ID, OPTS);
    expect(cleared.status).toBe('unsolved');
    expect(cleared.attempts).toBe(1);
    expect((await repo.listAttempts(CHALLENGE_ID)).length).toBe(1);
  });
});
