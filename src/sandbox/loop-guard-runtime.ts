import { LOOP_GUARD_FN } from '@/runner/loop-guard';

/** Iteration ceiling for any single injected loop id within one uninterrupted synchronous burst (spec §6.6). */
export const SINGLE_LOOP_LIMIT = 1_000_000;
/** Total iteration budget across all loops within one burst — catches nests that individually stay under the ceiling. */
export const MOUNT_TOTAL_LIMIT = 50_000_000;
/**
 * Counters reset on this native interval. A synchronously hung frame never reaches the interval, so the
 * limits still bound runaway loops; a long-lived preview mount (many event-loop turns) never false-trips.
 */
export const GUARD_RESET_INTERVAL_MS = 500;

export class LoopGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoopGuardError';
  }
}

// Declared as function-typed properties rather than method shorthand: interface method syntax
// carries an implicit polymorphic `this`, which is exactly what `typescript/unbound-method` flags
// when callers destructure `{ guard }`/`{ reset }` (as the tests and `installLoopGuard` do). Neither
// implementation reads `this`, so the property form is both accurate and lint-clean.
export interface LoopGuard {
  guard: (loopId: number) => void;
  reset: () => void;
}

export function createLoopGuard(): LoopGuard {
  let counts: number[] = [];
  let total = 0;
  return {
    guard(loopId: number): void {
      const count = (counts[loopId] ?? 0) + 1;
      counts[loopId] = count;
      total += 1;
      if (count > SINGLE_LOOP_LIMIT) {
        throw new LoopGuardError(
          `possible infinite loop: one loop ran more than ${SINGLE_LOOP_LIMIT.toLocaleString('en-US')} iterations`,
        );
      }
      if (total > MOUNT_TOTAL_LIMIT) {
        throw new LoopGuardError(
          `possible infinite loop: loop iterations exceeded the total budget of ${MOUNT_TOTAL_LIMIT.toLocaleString('en-US')}`,
        );
      }
    },
    reset(): void {
      counts = [];
      total = 0;
    },
  };
}

/**
 * Defines the guard as a global in the frame so blob modules (whose injected calls reference the
 * bare `__acLoopGuard` identifier) resolve it, and starts the periodic reset on the frame's native
 * `setInterval` (the virtual clock never patches timers, only rAF and now()).
 */
export function installLoopGuard(win: Window & typeof globalThis): LoopGuard {
  const loopGuard = createLoopGuard();
  Object.defineProperty(win, LOOP_GUARD_FN, { configurable: true, value: loopGuard.guard });
  win.setInterval(() => {
    loopGuard.reset();
  }, GUARD_RESET_INTERVAL_MS);
  return loopGuard;
}
