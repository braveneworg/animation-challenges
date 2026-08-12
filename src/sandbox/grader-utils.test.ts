import { expect, test } from 'vitest';

import { cssTransitionOn, forEachStep, numericFunction, pxNumber } from '@/sandbox/grader-utils';

// `cssTransitionOn` narrows its input with `instanceof CSSTransition`, the same way every grader
// narrows a known DOM type. This unit test runs under the Node project, which has no browser
// globals — so it registers a minimal stand-in for the real constructor. The helper's parameter
// is `readonly unknown[]` (not `Animation[]`) precisely so a plain test double like this one,
// with no `GradeContext`/real DOM fixture, is enough to exercise it.
class FakeCSSTransition {
  readonly transitionProperty: string;

  constructor(transitionProperty: string) {
    this.transitionProperty = transitionProperty;
  }
}
Object.defineProperty(globalThis, 'CSSTransition', { value: FakeCSSTransition, configurable: true, writable: true });

test('forEachStep awaits the action once per index, in order', async () => {
  const seen: number[] = [];
  await forEachStep(4, async (index) => {
    // A real await between pushes: out-of-order execution or a skipped index cannot slip through.
    await Promise.resolve();
    seen.push(index);
  });
  expect(seen).toEqual([0, 1, 2, 3]);
});

test('forEachStep with a count of zero never calls the action', async () => {
  let calls = 0;
  await forEachStep(0, async () => {
    calls += 1;
    return Promise.resolve();
  });
  expect(calls).toBe(0);
});

test('forEachStep waits for each action before starting the next', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  await forEachStep(3, async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
  });
  expect(maxInFlight).toBe(1);
});

test('pxNumber parses computed px and unitless strings, and NaNs the unparsable', () => {
  expect(pxNumber('400px')).toBe(400);
  expect(pxNumber('-6px')).toBe(-6);
  expect(pxNumber('0.6')).toBe(0.6);
  expect(Number.isNaN(pxNumber('auto'))).toBe(true);
  expect(Number.isNaN(pxNumber(''))).toBe(true);
});

test('numericFunction rejects non-functions', () => {
  expect(numericFunction(undefined)).toBeNull();
  expect(numericFunction(42)).toBeNull();
  expect(numericFunction({ call: 'me' })).toBeNull();
});

test('numericFunction wraps a real function and forwards arguments', () => {
  const wrapped = numericFunction((a: number, b: number) => a + b);
  expect(wrapped).not.toBeNull();
  expect(wrapped?.(2, 3)).toBe(5);
});

test('numericFunction turns non-numeric returns into NaN instead of leaking them', () => {
  const wrapped = numericFunction(() => 'not a number');
  expect(Number.isNaN(wrapped?.(1) ?? 0)).toBe(true);
});

test('cssTransitionOn finds the transition whose property is in the list', () => {
  const opacity = new FakeCSSTransition('opacity');
  const transform = new FakeCSSTransition('transform');
  expect(cssTransitionOn([opacity, transform], ['transform'])).toBe(transform);
});

test('cssTransitionOn matches any property from a family list, not just one exact name', () => {
  const scale = new FakeCSSTransition('scale');
  expect(cssTransitionOn([scale], ['transform', 'translate', 'scale', 'rotate'])).toBe(scale);
});

test('cssTransitionOn returns null when no running transition matches', () => {
  const opacity = new FakeCSSTransition('opacity');
  expect(cssTransitionOn([opacity], ['transform'])).toBeNull();
});

test('cssTransitionOn returns null for an empty animations list', () => {
  expect(cssTransitionOn([], ['transform'])).toBeNull();
});

test('cssTransitionOn ignores a look-alike object that is not a real CSSTransition instance', () => {
  const impostor = { transitionProperty: 'transform' };
  expect(cssTransitionOn([impostor], ['transform'])).toBeNull();
});
