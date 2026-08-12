import { describe, expect, it } from 'vitest';

import type { ProgressRecord } from '@/data/records';
import { seriesProgressFor } from '@/features/workspace/series-progress';
import { makeChallenge } from '@/test/challenge-fixture';

const series = { id: 'bounce-in' as const, label: 'Bounce-in' };
const a = makeChallenge('css-keyframes/bounce-in', { series });
const b = makeChallenge('waapi/bounce-in-waapi', { series });
const c = makeChallenge('motion-react-basics/bounce-in-spring', { series });
const unrelated = makeChallenge('css-transitions/hover-lift');

function solved(challengeId: string): ProgressRecord {
  return {
    id: challengeId,
    challengeId,
    status: 'solved',
    solveQuality: 'clean',
    attempts: 1,
    hintsRevealed: 0,
    updatedAt: '2026-08-10T00:00:00.000Z',
  };
}

describe('seriesProgressFor', () => {
  it('returns null for a challenge without a series', () => {
    expect(seriesProgressFor(unrelated, [a, b, c, unrelated], new Map())).toBeNull();
  });

  it('counts solved members among authored members and lists siblings', () => {
    const progress = new Map([
      [a.id, solved(a.id)],
      [b.id, solved(b.id)],
    ]);
    const result = seriesProgressFor(a, [a, b, c, unrelated], progress);
    expect(result?.authored).toBe(3);
    expect(result?.solved).toBe(2);
    expect(result?.siblings.map((sibling) => sibling.id)).toEqual([b.id, c.id]);
  });
});
