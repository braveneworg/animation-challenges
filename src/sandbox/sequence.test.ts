import { expect, test } from 'vitest';

import { forEachStep } from '@/sandbox/sequence';

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

test('runs actions strictly in order across real awaits', async () => {
  const seen: number[] = [];
  await forEachStep(4, async (index) => {
    await tick();
    seen.push(index);
  });
  expect(seen).toEqual([0, 1, 2, 3]);
});

test('a zero count runs nothing', async () => {
  const seen: number[] = [];
  await forEachStep(0, async (index) => {
    seen.push(index);
  });
  expect(seen).toEqual([]);
});

test('steps never overlap: each action finishes before the next starts', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  await forEachStep(5, async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await tick();
    inFlight -= 1;
  });
  expect(maxInFlight).toBe(1);
});

test('an action resolving false stops the remaining steps', async () => {
  const seen: number[] = [];
  await forEachStep(10, async (index) => {
    seen.push(index);
    return index === 2 ? false : undefined;
  });
  expect(seen).toEqual([0, 1, 2]);
});
