import { describe, expect, it } from 'vitest';

import { CATEGORIES, TOTAL_PLANNED_CHALLENGES } from '@/challenges/categories';
import { challengeRegistry } from '@/challenges/registry';
import { SERIES_IDS } from '@/challenges/series';
import type { Challenge, ChallengeSeriesRef } from '@/challenges/types';

const { challenges, byId, errors } = challengeRegistry;

describe('catalog integrity', () => {
  it('has no registry errors', () => {
    expect(errors).toEqual([]);
  });

  it('contains at least one challenge', () => {
    expect(challenges.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    expect(new Set(challenges.map((entry) => entry.id)).size).toBe(challenges.length);
  });

  it('resolves every relatedId to a real challenge', () => {
    for (const entry of challenges) {
      for (const relatedId of entry.relatedIds) {
        expect(byId.has(relatedId), `${entry.id} references missing challenge ${relatedId}`).toBe(true);
      }
    }
  });

  it('never lists itself as related', () => {
    for (const entry of challenges) {
      expect(entry.relatedIds).not.toContain(entry.id);
    }
  });

  it('uses only known series ids', () => {
    const hasSeries = (entry: Challenge): entry is Challenge & { series: ChallengeSeriesRef } =>
      entry.series !== undefined;

    for (const entry of challenges.filter(hasSeries)) {
      expect(SERIES_IDS).toContain(entry.series.id);
    }
  });

  it('requires a non-empty rubric whenever gradeMode is not auto', () => {
    const requiresRubric = (entry: Challenge): boolean => entry.gradeMode !== 'auto';

    for (const entry of challenges.filter(requiresRubric)) {
      expect(entry.rubric?.length ?? 0, `${entry.id} needs a rubric`).toBeGreaterThan(0);
    }
  });

  it('gives every challenge a distinct starter and solution', () => {
    for (const entry of challenges) {
      expect(JSON.stringify(entry.starter), `${entry.id} starter equals its solution`).not.toBe(
        JSON.stringify(entry.solution),
      );
    }
  });

  it('declares the same file names in starter and solution', () => {
    for (const entry of challenges) {
      expect(Object.keys(entry.starter).sort(), `${entry.id} file sets differ`).toEqual(
        Object.keys(entry.solution).sort(),
      );
    }
  });

  it('never exceeds the planned count for a category', () => {
    for (const category of CATEGORIES) {
      const actual = challenges.filter((entry) => entry.categoryId === category.id).length;
      expect(actual, `${category.id} has ${actual} challenges but plans ${category.plannedCount}`).toBeLessThanOrEqual(
        category.plannedCount,
      );
    }
  });

  it('never exceeds the planned catalog total', () => {
    expect(challenges.length).toBeLessThanOrEqual(TOTAL_PLANNED_CHALLENGES);
  });
});
