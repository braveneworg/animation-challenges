import { describe, expect, it } from 'vitest';

import type { CategoryId } from '@/challenges/categories';
import { checkCatalogIntegrity, type CatalogEntry } from '@/challenges/integrity';

/**
 * A clean entry. Every fixture below starts here and breaks exactly one rule, so an assertion on
 * the full violation list pins that rule and nothing else.
 */
function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'css-transitions/hover-lift',
    title: 'Hover lift',
    categoryId: 'css-transitions',
    difficulty: 'novice',
    tech: ['css'],
    runtime: 'dom',
    brief: 'Lift the card on hover.',
    goals: ['The card moves up on hover.'],
    starter: { 'styles.css': '.card { }' },
    solution: { 'styles.css': '.card { transition: transform 200ms; }' },
    explanation: 'Transition transform, never all.',
    gradeMode: 'auto',
    hints: [],
    relatedIds: [],
    estimatedMinutes: 5,
    tags: ['transition'],
    ...overrides,
  };
}

function manyIn(categoryId: CategoryId, count: number): CatalogEntry[] {
  return Array.from({ length: count }, (_unused, index) =>
    entry({ id: `${categoryId}/challenge-${index}`, categoryId }),
  );
}

describe('checkCatalogIntegrity', () => {
  it('returns no violations for a clean catalog', () => {
    expect(checkCatalogIntegrity([entry()])).toEqual([]);
  });

  it('returns no violations for an empty catalog', () => {
    expect(checkCatalogIntegrity([])).toEqual([]);
  });

  it('reports a duplicate id', () => {
    const violations = checkCatalogIntegrity([entry(), entry()]);

    expect(violations).toEqual(['duplicate id "css-transitions/hover-lift"']);
  });

  it('reports a relatedId that resolves to nothing', () => {
    const violations = checkCatalogIntegrity([entry({ relatedIds: ['css-transitions/does-not-exist'] })]);

    expect(violations).toEqual([
      'css-transitions/hover-lift: relatedId "css-transitions/does-not-exist" does not resolve to a challenge in the catalog',
    ]);
  });

  it('reports a challenge that lists itself as related', () => {
    const violations = checkCatalogIntegrity([entry({ relatedIds: ['css-transitions/hover-lift'] })]);

    expect(violations).toEqual(['css-transitions/hover-lift: lists itself in relatedIds']);
  });

  it('reports an unknown series id', () => {
    const violations = checkCatalogIntegrity([entry({ series: { id: 'not-a-series', label: 'Nope' } })]);

    expect(violations).toEqual(['css-transitions/hover-lift: unknown series id "not-a-series"']);
  });

  it('accepts a known series id', () => {
    expect(checkCatalogIntegrity([entry({ series: { id: 'card-flip', label: 'Card flip' } })])).toEqual([]);
  });

  it('reports a missing rubric when gradeMode is rubric', () => {
    const violations = checkCatalogIntegrity([entry({ gradeMode: 'rubric' })]);

    expect(violations).toEqual(['css-transitions/hover-lift: gradeMode "rubric" requires a non-empty rubric']);
  });

  it('reports a missing rubric when gradeMode is hybrid', () => {
    const violations = checkCatalogIntegrity([entry({ gradeMode: 'hybrid', rubric: [] })]);

    expect(violations).toEqual(['css-transitions/hover-lift: gradeMode "hybrid" requires a non-empty rubric']);
  });

  it('accepts a non-auto gradeMode that carries a rubric', () => {
    const violations = checkCatalogIntegrity([
      entry({ gradeMode: 'hybrid', rubric: [{ id: 'feels-right', label: 'The lift feels responsive.' }] }),
    ]);

    expect(violations).toEqual([]);
  });

  it('reports a starter identical to its solution', () => {
    const files = { 'styles.css': '.card { }' };
    const violations = checkCatalogIntegrity([entry({ starter: files, solution: { ...files } })]);

    expect(violations).toEqual(['css-transitions/hover-lift: starter and solution are identical']);
  });

  it('reports a starter identical to its solution even when the keys are in a different order', () => {
    // The previous implementation compared with `JSON.stringify`, which is key-order sensitive, so
    // these two semantically identical file maps were wrongly judged distinct and the rule stayed
    // silent. This is the fixture that distinguishes the two comparisons.
    const violations = checkCatalogIntegrity([
      entry({
        starter: { 'index.html': '<div></div>', 'styles.css': '.card { }' },
        solution: { 'styles.css': '.card { }', 'index.html': '<div></div>' },
      }),
    ]);

    expect(violations).toEqual(['css-transitions/hover-lift: starter and solution are identical']);
  });

  it('treats file maps with the same keys but different contents as distinct', () => {
    const violations = checkCatalogIntegrity([
      entry({ starter: { 'styles.css': 'a' }, solution: { 'styles.css': 'b' } }),
    ]);

    expect(violations).toEqual([]);
  });

  it('reports starter and solution declaring different file names', () => {
    const violations = checkCatalogIntegrity([entry({ starter: { 'styles.css': 'a' }, solution: { 'main.ts': 'b' } })]);

    expect(violations).toEqual([
      'css-transitions/hover-lift: starter files [styles.css] do not match solution files [main.ts]',
    ]);
  });

  it('reports a category that exceeds its planned count', () => {
    // css-transitions plans 6.
    const violations = checkCatalogIntegrity(manyIn('css-transitions', 7));

    expect(violations).toEqual(['css-transitions: 7 challenges exceeds the planned 6']);
  });

  it('accepts a category exactly at its planned count', () => {
    expect(checkCatalogIntegrity(manyIn('css-transitions', 6))).toEqual([]);
  });

  it('reports a catalog that exceeds the planned total', () => {
    // 123 are planned in total, and the total is the sum of the per-category ceilings, so
    // exceeding it necessarily exceeds a category ceiling too. Assert on the total's own message.
    const violations = checkCatalogIntegrity(manyIn('css-transitions', 124));

    expect(violations).toContain('catalog holds 124 challenges, which exceeds the planned total of 123');
  });

  it('reports every violation it finds, not just the first', () => {
    const violations = checkCatalogIntegrity([
      entry({ relatedIds: ['css-transitions/hover-lift', 'css-transitions/missing'], gradeMode: 'rubric' }),
    ]);

    expect(violations).toEqual([
      'css-transitions/hover-lift: relatedId "css-transitions/missing" does not resolve to a challenge in the catalog',
      'css-transitions/hover-lift: lists itself in relatedIds',
      'css-transitions/hover-lift: gradeMode "rubric" requires a non-empty rubric',
    ]);
  });
});
