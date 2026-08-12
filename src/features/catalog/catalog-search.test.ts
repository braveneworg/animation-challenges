import { describe, expect, it } from 'vitest';

import type { ProgressRecord } from '@/data/records';
import { allTags, challengeStatus, filterChallenges, parseCatalogSearch } from '@/features/catalog/catalog-search';
import { makeChallenge } from '@/test/challenge-fixture';

const css = makeChallenge('css-transitions/hover-lift', { difficulty: 'novice', tech: ['css'], tags: ['hover'] });
const waapi = makeChallenge('waapi/bounce-in', {
  categoryId: 'waapi',
  title: 'Bounce with WAAPI',
  difficulty: 'intermediate',
  tech: ['waapi', 'ts'],
  tags: ['bounce'],
});

function record(challengeId: string, status: ProgressRecord['status']): ProgressRecord {
  return {
    id: challengeId,
    challengeId,
    status,
    solveQuality: status === 'solved' ? 'clean' : null,
    attempts: 1,
    hintsRevealed: 0,
    updatedAt: '2026-08-10T00:00:00.000Z',
  };
}

describe('parseCatalogSearch', () => {
  it('keeps valid params and drops invalid ones instead of throwing', () => {
    expect(parseCatalogSearch({ category: 'waapi', difficulty: 'novice' })).toEqual({
      category: 'waapi',
      difficulty: 'novice',
    });
    expect(parseCatalogSearch({ category: 'not-a-category', difficulty: 12 })).toEqual({});
    expect(parseCatalogSearch({ q: '' })).toEqual({});
  });
});

describe('filterChallenges', () => {
  const progress = new Map([[waapi.id, record(waapi.id, 'solved')]]);

  it('filters by category, difficulty, tech, and tag', () => {
    expect(filterChallenges([css, waapi], { category: 'waapi' }, progress)).toEqual([waapi]);
    expect(filterChallenges([css, waapi], { difficulty: 'novice' }, progress)).toEqual([css]);
    expect(filterChallenges([css, waapi], { tech: 'ts' }, progress)).toEqual([waapi]);
    expect(filterChallenges([css, waapi], { tag: 'hover' }, progress)).toEqual([css]);
  });

  it('treats challenges without a record as unsolved for the status filter', () => {
    expect(filterChallenges([css, waapi], { status: 'unsolved' }, progress)).toEqual([css]);
    expect(filterChallenges([css, waapi], { status: 'solved' }, progress)).toEqual([waapi]);
  });

  it('matches the query against title, id, and tags, case-insensitively', () => {
    expect(filterChallenges([css, waapi], { q: 'BOUNCE' }, progress)).toEqual([waapi]);
    expect(filterChallenges([css, waapi], { q: 'hover-lift' }, progress)).toEqual([css]);
    expect(filterChallenges([css, waapi], { q: 'nothing-matches' }, progress)).toEqual([]);
  });

  it('combines filters with AND semantics', () => {
    expect(filterChallenges([css, waapi], { category: 'waapi', status: 'unsolved' }, progress)).toEqual([]);
  });
});

describe('helpers', () => {
  it('challengeStatus defaults to unsolved', () => {
    expect(challengeStatus(undefined)).toBe('unsolved');
    expect(challengeStatus(record('a/b', 'attempted'))).toBe('attempted');
  });

  it('allTags returns a sorted unique list', () => {
    expect(allTags([css, waapi, makeChallenge('x/y', { tags: ['hover'] })])).toEqual(['bounce', 'hover']);
  });
});
