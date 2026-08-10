import { describe, expect, it } from 'vitest';

import { CATEGORIES, CATEGORY_IDS, TOTAL_PLANNED_CHALLENGES } from '@/challenges/categories';
import { SERIES, SERIES_IDS } from '@/challenges/series';

describe('categories', () => {
  it('defines the 22 categories from the spec', () => {
    expect(CATEGORY_IDS).toHaveLength(22);
    expect(CATEGORIES).toHaveLength(22);
  });

  it('has a definition for every id, in the same order', () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual([...CATEGORY_IDS]);
  });

  it('has unique ids', () => {
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length);
  });

  it('plans exactly 123 challenges in total', () => {
    const sum = CATEGORIES.reduce((total, category) => total + category.plannedCount, 0);
    expect(sum).toBe(123);
    expect(TOTAL_PLANNED_CHALLENGES).toBe(123);
  });

  it('plans at least four challenges per category', () => {
    for (const category of CATEGORIES) {
      expect(category.plannedCount).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('series', () => {
  it('defines the six cross-technique series', () => {
    expect(SERIES_IDS).toHaveLength(6);
    expect(SERIES).toHaveLength(6);
  });

  it('plans three members for every series', () => {
    for (const series of SERIES) {
      expect(series.plannedMembers).toBe(3);
    }
  });
});
