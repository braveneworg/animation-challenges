import { expect, test } from 'vitest';

import { runWithTimeout } from '@/runner/run-with-timeout';

const never: (callback: () => void, ms: number) => unknown = () => undefined;
const immediate: (callback: () => void, ms: number) => unknown = (callback) => {
  callback();
  return undefined;
};

test('a resolving grader reports no throw and no timeout', async () => {
  await expect(runWithTimeout(Promise.resolve(), 5000, never)).resolves.toEqual({ threw: null, timedOut: false });
});

test('a rejecting grader reports message and stack', async () => {
  const outcome = await runWithTimeout(Promise.reject(new Error('boom')), 5000, never);
  expect(outcome.timedOut).toBe(false);
  expect(outcome.threw?.message).toBe('boom');
  expect(typeof outcome.threw?.stack).toBe('string');
});

test('a hung grader times out', async () => {
  const outcome = await runWithTimeout(new Promise<void>(() => undefined), 5000, immediate);
  expect(outcome).toEqual({ threw: null, timedOut: true });
});

test('late completion does not override an already-reported timeout', async () => {
  // DEVIATION FROM THE BRIEF: declared `| undefined` rather than `| null`. TypeScript 7.0.2's
  // control-flow analysis narrows a `let x: T | null = null` reassigned inside a `Promise`
  // executor to `never` at this later read (reproduced in isolation, independent of this repo's
  // tsconfig) — `release?.()` below fails with TS2349 "Type 'never' has no call signatures." The
  // identical shape with `| undefined` typechecks correctly; runtime behaviour is unchanged.
  let release: (() => void) | undefined;
  const work = new Promise<void>((resolve) => {
    release = resolve;
  });
  const outcome = await runWithTimeout(work, 1, immediate);
  release?.();
  expect(outcome.timedOut).toBe(true);
});
