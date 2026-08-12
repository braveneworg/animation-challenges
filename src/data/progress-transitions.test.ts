import { describe, expect, it } from 'vitest';

import {
  applyClear,
  applyHintRevealed,
  applySolutionViewed,
  applySubmit,
  initialProgressRecord,
} from '@/data/progress-transitions';

const T0 = '2026-08-01T10:00:00.000Z';
const T1 = '2026-08-01T10:05:00.000Z';
const T2 = '2026-08-01T10:10:00.000Z';
const T3 = '2026-08-01T10:15:00.000Z';

const CHALLENGE_ID = 'css-transitions/hover-lift';

describe('initialProgressRecord', () => {
  it('starts unsolved with zero counters', () => {
    expect(initialProgressRecord(CHALLENGE_ID, T0)).toEqual({
      id: CHALLENGE_ID,
      challengeId: CHALLENGE_ID,
      status: 'unsolved',
      solveQuality: null,
      attempts: 0,
      hintsRevealed: 0,
      updatedAt: T0,
    });
  });
});

describe('applySubmit', () => {
  it('a failed submit moves unsolved to attempted and counts the attempt', () => {
    const next = applySubmit(initialProgressRecord(CHALLENGE_ID, T0), { passed: false, nowIso: T1 });
    expect(next.status).toBe('attempted');
    expect(next.attempts).toBe(1);
    expect(next.lastAttemptAt).toBe(T1);
    expect(next.updatedAt).toBe(T1);
    expect(next.solveQuality).toBeNull();
  });

  it('a passing submit with no solution viewed is a clean solve', () => {
    const next = applySubmit(initialProgressRecord(CHALLENGE_ID, T0), { passed: true, nowIso: T1 });
    expect(next.status).toBe('solved');
    expect(next.solveQuality).toBe('clean');
    expect(next.firstSolvedAt).toBe(T1);
  });

  it('hints revealed before the first pass still yield a clean solve', () => {
    const withHints = applyHintRevealed(applyHintRevealed(initialProgressRecord(CHALLENGE_ID, T0), T1), T1);
    const next = applySubmit(withHints, { passed: true, nowIso: T2 });
    expect(next.solveQuality).toBe('clean');
    expect(next.hintsRevealed).toBe(2);
  });

  it('viewing the solution before the first pass yields an assisted solve — and still a solve', () => {
    const spoiled = applySolutionViewed(initialProgressRecord(CHALLENGE_ID, T0), T1);
    const next = applySubmit(spoiled, { passed: true, nowIso: T2 });
    expect(next.status).toBe('solved');
    expect(next.solveQuality).toBe('assisted');
  });

  it('a later failed submit never downgrades a solve', () => {
    const solved = applySubmit(initialProgressRecord(CHALLENGE_ID, T0), { passed: true, nowIso: T1 });
    const next = applySubmit(solved, { passed: false, nowIso: T2 });
    expect(next.status).toBe('solved');
    expect(next.solveQuality).toBe('clean');
    expect(next.firstSolvedAt).toBe(T1);
    expect(next.attempts).toBe(2);
  });

  it('a second passing submit keeps the first solve timestamp and quality', () => {
    const spoiled = applySolutionViewed(initialProgressRecord(CHALLENGE_ID, T0), T1);
    const solved = applySubmit(spoiled, { passed: true, nowIso: T2 });
    const again = applySubmit(solved, { passed: true, nowIso: T3 });
    expect(again.firstSolvedAt).toBe(T2);
    expect(again.solveQuality).toBe('assisted');
  });
});

describe('applySolutionViewed', () => {
  it('stamps viewedSolutionAt on first view only', () => {
    const once = applySolutionViewed(initialProgressRecord(CHALLENGE_ID, T0), T1);
    const twice = applySolutionViewed(once, T2);
    expect(twice.viewedSolutionAt).toBe(T1);
    expect(twice.updatedAt).toBe(T2);
  });

  it('viewing the solution AFTER a clean solve keeps it clean', () => {
    const solved = applySubmit(initialProgressRecord(CHALLENGE_ID, T0), { passed: true, nowIso: T1 });
    const peeked = applySolutionViewed(solved, T2);
    expect(peeked.status).toBe('solved');
    expect(peeked.solveQuality).toBe('clean');
  });
});

describe('applyClear', () => {
  it('resets the working state but keeps the attempt counter and lastAttemptAt', () => {
    const spoiled = applySolutionViewed(applyHintRevealed(initialProgressRecord(CHALLENGE_ID, T0), T1), T1);
    const solved = applySubmit(spoiled, { passed: true, nowIso: T2 });
    const cleared = applyClear(solved, T3);
    expect(cleared).toEqual({
      id: CHALLENGE_ID,
      challengeId: CHALLENGE_ID,
      status: 'unsolved',
      solveQuality: null,
      attempts: 1,
      hintsRevealed: 0,
      lastAttemptAt: T2,
      updatedAt: T3,
    });
    expect(cleared.firstSolvedAt).toBeUndefined();
    expect(cleared.viewedSolutionAt).toBeUndefined();
  });

  it('a clean re-solve after Clear genuinely upgrades the record', () => {
    const spoiled = applySolutionViewed(initialProgressRecord(CHALLENGE_ID, T0), T1);
    const assisted = applySubmit(spoiled, { passed: true, nowIso: T2 });
    expect(assisted.solveQuality).toBe('assisted');
    const resolved = applySubmit(applyClear(assisted, T2), { passed: true, nowIso: T3 });
    expect(resolved.solveQuality).toBe('clean');
    expect(resolved.attempts).toBe(2);
  });
});

describe('applyHintRevealed', () => {
  it('increments the count and touches updatedAt, nothing else', () => {
    const solved = applySubmit(initialProgressRecord(CHALLENGE_ID, T0), { passed: true, nowIso: T1 });
    const hinted = applyHintRevealed(solved, T2);
    expect(hinted).toEqual({ ...solved, hintsRevealed: 1, updatedAt: T2 });
  });
});
