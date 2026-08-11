import { expect, test } from 'vitest';

import { graderIds, graderPathToId, loadGrader } from '@/sandbox/grader-registry';

test('maps grader module paths to challenge ids', () => {
  expect(graderPathToId('../challenges/css-transitions/hover-lift.grade.ts')).toBe('css-transitions/hover-lift');
  expect(graderPathToId('../challenges/easing-math/lerp.grade.ts')).toBe('easing-math/lerp');
});

test('the glob collects the hover-lift grader', () => {
  // toContain, not toEqual: Plans 03/06 add graders without touching this test.
  expect(graderIds).toContain('css-transitions/hover-lift');
});

test('underscore-prefixed fixture graders are loadable but never listed', async () => {
  expect(graderIds.every((id) => !(id.split('/')[1] ?? '').startsWith('_'))).toBe(true);
  expect(await loadGrader('css-transitions/_timeout-fixture')).not.toBeNull();
});
