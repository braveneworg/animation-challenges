import { describe, expect, it } from 'vitest';

import { safeParseChallenge, type ParseChallengeResult } from '@/challenges/schema';
import type { Challenge } from '@/challenges/types';

/**
 * Narrows a `ParseChallengeResult` to its failure branch, throwing if it was actually a success.
 *
 * Used instead of `if (!result.success) { expect(...) }` because oxlint's
 * `vitest/no-conditional-expect` rule forbids `expect` calls inside a conditional block: a
 * failing assertion there would be silently skipped rather than failing the test. This assertion
 * function narrows the type unconditionally, so the `expect` calls that follow always run.
 */
function assertFailure(result: ParseChallengeResult): asserts result is { success: false; issues: string[] } {
  if (result.success) {
    throw new Error('expected safeParseChallenge to report a failure');
  }
}

function validChallenge(): Challenge {
  return {
    id: 'css-transitions/hover-lift',
    title: 'Hover lift',
    categoryId: 'css-transitions',
    difficulty: 'novice',
    tech: ['css'],
    runtime: 'dom',
    brief: 'Lift the card on hover.',
    goals: ['The card moves up on hover.'],
    starter: { 'index.html': '<div class="card"></div>', 'styles.css': '.card { }' },
    solution: { 'index.html': '<div class="card"></div>', 'styles.css': '.card { transition: transform 200ms; }' },
    explanation: 'Transition transform, never all.',
    gradeMode: 'auto',
    hints: ['Which properties are cheap to animate?'],
    relatedIds: [],
    estimatedMinutes: 5,
    tags: ['transition'],
  };
}

describe('challenge schema', () => {
  it('accepts a valid challenge', () => {
    const result = safeParseChallenge(validChallenge());
    expect(result.success).toBe(true);
  });

  it('rejects an id that does not match categoryId/slug', () => {
    const result = safeParseChallenge({ ...validChallenge(), id: 'waapi/hover-lift' });
    expect(result.success).toBe(false);
    assertFailure(result);
    expect(result.issues.join(' ')).toMatch(/id must start with the categoryId/i);
  });

  it('rejects an unknown category', () => {
    const result = safeParseChallenge({ ...validChallenge(), categoryId: 'not-a-category' });
    expect(result.success).toBe(false);
  });

  it('requires a rubric when gradeMode is rubric', () => {
    const result = safeParseChallenge({ ...validChallenge(), gradeMode: 'rubric' });
    expect(result.success).toBe(false);
    assertFailure(result);
    expect(result.issues.join(' ')).toMatch(/rubric/i);
  });

  it('requires a rubric when gradeMode is hybrid', () => {
    const result = safeParseChallenge({ ...validChallenge(), gradeMode: 'hybrid' });
    expect(result.success).toBe(false);
  });

  it('accepts hybrid when a non-empty rubric is present', () => {
    const result = safeParseChallenge({
      ...validChallenge(),
      gradeMode: 'hybrid',
      rubric: [{ id: 'feels-right', label: 'The lift feels responsive, not floaty.' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty starter files', () => {
    const result = safeParseChallenge({ ...validChallenge(), starter: {} });
    expect(result.success).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = safeParseChallenge({ ...validChallenge(), somethingElse: true });
    expect(result.success).toBe(false);
  });

  it('rejects goals that are empty', () => {
    const result = safeParseChallenge({ ...validChallenge(), goals: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an id with more than one slash', () => {
    const result = safeParseChallenge({ ...validChallenge(), id: 'css-transitions/sub/hover-lift' });
    expect(result.success).toBe(false);
    assertFailure(result);
    expect(result.issues.join(' ')).toMatch(/exactly one slash/i);
  });

  it('rejects an id with an empty slug', () => {
    const result = safeParseChallenge({ ...validChallenge(), id: 'css-transitions/' });
    expect(result.success).toBe(false);
    assertFailure(result);
    expect(result.issues.join(' ')).toMatch(/kebab-case/i);
  });

  it('rejects an id whose slug has uppercase letters, spaces, or punctuation', () => {
    const result = safeParseChallenge({ ...validChallenge(), id: 'css-transitions/Hover Lift!!' });
    expect(result.success).toBe(false);
    assertFailure(result);
    expect(result.issues.join(' ')).toMatch(/kebab-case/i);
  });

  it('rejects an id whose slug has trailing whitespace', () => {
    const result = safeParseChallenge({ ...validChallenge(), id: 'css-transitions/hover-lift   ' });
    expect(result.success).toBe(false);
    assertFailure(result);
    expect(result.issues.join(' ')).toMatch(/kebab-case/i);
  });
});
