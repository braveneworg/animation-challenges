import { describe, expect, test } from 'vitest';

import { createLoopGuard, LoopGuardError, MOUNT_TOTAL_LIMIT, SINGLE_LOOP_LIMIT } from '@/sandbox/loop-guard-runtime';

describe('createLoopGuard', () => {
  test('allows a loop up to the single-loop limit', () => {
    const { guard } = createLoopGuard();
    for (let i = 0; i < SINGLE_LOOP_LIMIT; i += 1) guard(0);
    // One more trips it.
    expect(() => guard(0)).toThrow(LoopGuardError);
  });

  test('the thrown error is recognisable by name', () => {
    const { guard } = createLoopGuard();
    let caught: unknown = null;
    try {
      for (let i = 0; i <= SINGLE_LOOP_LIMIT; i += 1) guard(1);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoopGuardError);
    expect(caught instanceof Error && caught.name).toBe('LoopGuardError');
  });

  test('nested loops individually under the ceiling trip the total budget', () => {
    const { guard } = createLoopGuard();
    // 100 distinct loop ids × 900,000 iterations each: every id stays under SINGLE_LOOP_LIMIT,
    // but the total (90,000,000) crosses MOUNT_TOTAL_LIMIT part-way through.
    expect(SINGLE_LOOP_LIMIT * 100).toBeGreaterThan(MOUNT_TOTAL_LIMIT);
    expect(() => {
      for (let id = 0; id < 100; id += 1) {
        for (let i = 0; i < 900_000; i += 1) guard(id);
      }
    }).toThrow(LoopGuardError);
  });

  test('reset clears both per-loop counts and the total budget', () => {
    const { guard, reset } = createLoopGuard();
    for (let i = 0; i < SINGLE_LOOP_LIMIT; i += 1) guard(0);
    reset();
    expect(() => {
      for (let i = 0; i < 1000; i += 1) guard(0);
    }).not.toThrow();
  });
});
