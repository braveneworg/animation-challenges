import { describe, expect, it } from 'vitest';

import type { Category } from '@/challenges/categories';
import type { ProgressRecord } from '@/data/records';
import {
  continueChallenge,
  overallCompletion,
  solveQualityCounts,
  summarizeCategories,
  summarizeSeries,
  weakestCategory,
} from '@/features/progress/dashboard-selectors';
import { makeChallenge } from '@/test/challenge-fixture';

const hover = makeChallenge('css-transitions/hover-lift');
const compositor = makeChallenge('css-transitions/compositor-move');
const bounce = makeChallenge('css-keyframes/bounce-in', {
  categoryId: 'css-keyframes',
  series: { id: 'bounce-in', label: 'Bounce-in' },
});

function record(challengeId: string, overrides: Partial<ProgressRecord> = {}): ProgressRecord {
  const base: ProgressRecord = {
    id: challengeId,
    challengeId,
    status: 'attempted',
    solveQuality: null,
    attempts: 1,
    hintsRevealed: 0,
    updatedAt: '2026-08-10T00:00:00.000Z',
  };
  return Object.assign({}, base, overrides);
}

const solvedHover = record(hover.id, { status: 'solved', solveQuality: 'clean' });

describe('overallCompletion and summarizeCategories', () => {
  it('counts solved among authored and reports the 123 planned total', () => {
    const completion = overallCompletion([hover, compositor, bounce], new Map([[hover.id, solvedHover]]));
    expect(completion).toEqual({ solved: 1, authored: 3, planned: 123 });
  });

  it('summarizes per category with authored and solved counts', () => {
    const categories: Category[] = [
      { id: 'css-transitions', title: 'Transitions', blurb: '', plannedCount: 6 },
      { id: 'css-keyframes', title: 'Keyframes', blurb: '', plannedCount: 6 },
    ];
    const summaries = summarizeCategories(categories, [hover, compositor, bounce], new Map([[hover.id, solvedHover]]));
    expect(summaries[0]).toEqual({
      categoryId: 'css-transitions',
      title: 'Transitions',
      authored: 2,
      solved: 1,
      plannedCount: 6,
    });
    expect(summaries[1]?.authored).toBe(1);
  });
});

describe('continueChallenge', () => {
  it('returns the most recently attempted unsolved challenge', () => {
    const older = record(hover.id, { lastAttemptAt: '2026-08-01T00:00:00.000Z' });
    const newer = record(bounce.id, { lastAttemptAt: '2026-08-09T00:00:00.000Z' });
    expect(continueChallenge([hover, compositor, bounce], [older, newer])?.id).toBe(bounce.id);
  });

  it('ignores solved records and returns null when nothing is in flight', () => {
    expect(continueChallenge([hover], [solvedHover])).toBeNull();
    expect(continueChallenge([hover], [])).toBeNull();
  });

  // solvedHover above carries no lastAttemptAt, so it's already excluded by that check alone —
  // this case is the one that actually exercises the `status === 'attempted'` filter, since a
  // real solved record's lastAttemptAt is typically still set from the attempt that solved it.
  it('excludes a solved record even when it still carries a lastAttemptAt', () => {
    const solvedWithAttempt = record(hover.id, {
      status: 'solved',
      solveQuality: 'clean',
      lastAttemptAt: '2026-08-05T00:00:00.000Z',
    });
    expect(continueChallenge([hover], [solvedWithAttempt])).toBeNull();
  });
});

describe('weakestCategory', () => {
  it('picks the lowest solve ratio among categories with authored work left', () => {
    const summaries = [
      { categoryId: 'css-transitions' as const, title: 'A', authored: 2, solved: 1, plannedCount: 6 },
      { categoryId: 'css-keyframes' as const, title: 'B', authored: 3, solved: 0, plannedCount: 6 },
    ];
    expect(weakestCategory(summaries)?.categoryId).toBe('css-keyframes');
  });

  it('breaks a tied ratio in favor of fewer solves', () => {
    const summaries = [
      { categoryId: 'css-transitions' as const, title: 'A', authored: 4, solved: 2, plannedCount: 6 },
      { categoryId: 'css-keyframes' as const, title: 'B', authored: 2, solved: 1, plannedCount: 6 },
    ];
    // Both are at a 50% ratio; the category with fewer absolute solves (B, 1 of 2) wins the tie
    // over the one with more (A, 2 of 4), per the documented "ties -> fewer solved" rule.
    expect(weakestCategory(summaries)?.categoryId).toBe('css-keyframes');
  });

  it('skips empty and fully solved categories; null when none qualify', () => {
    const summaries = [
      { categoryId: 'css-transitions' as const, title: 'A', authored: 0, solved: 0, plannedCount: 6 },
      { categoryId: 'css-keyframes' as const, title: 'B', authored: 1, solved: 1, plannedCount: 6 },
    ];
    expect(weakestCategory(summaries)).toBeNull();
  });
});

describe('series and quality', () => {
  it('summarizes series completion over authored members', () => {
    const summaries = summarizeSeries(
      [{ id: 'bounce-in', label: 'Bounce-in', blurb: '', plannedMembers: 3 }],
      [hover, bounce],
      new Map([[bounce.id, record(bounce.id, { status: 'solved', solveQuality: 'assisted' })]]),
    );
    expect(summaries[0]).toEqual({ id: 'bounce-in', label: 'Bounce-in', authored: 1, solved: 1, plannedMembers: 3 });
  });

  it('counts solve quality across records', () => {
    expect(
      solveQualityCounts([solvedHover, record(bounce.id, { status: 'solved', solveQuality: 'assisted' })]),
    ).toEqual({ clean: 1, assisted: 1 });
  });
});
