/**
 * Shared helpers for challenge graders (`src/challenges/<category>/<slug>.grade.ts`).
 *
 * They live in `src/sandbox/`, not in a category directory, because the challenge-registry glob
 * (every top-level `.ts` file under a category folder, minus grade/test files) would try to
 * validate any module it finds there as a challenge definition and fail the registry.
 *
 * `forEachStep` is re-exported from `@/sandbox/sequence` (Plan 02's shared recursive stepper — the
 * lint config errors on `await` inside loop syntax) so graders import every helper from one place.
 * Frame-sampling graders call it with `ctx.time.stepFrames(1)` inside the action; recursion depth
 * equals the step count, which stays in the low hundreds.
 */
export { forEachStep } from '@/sandbox/sequence';

/**
 * `Number.parseFloat` for computed style strings (`'400px'` → 400, `'0.6'` → 0.6). Unparsable
 * input becomes `NaN`, which fails any `expectClose` it reaches — a bad read surfaces as a hinted
 * failing assertion, never an opaque grader throw.
 */
export function pxNumber(value: string): number {
  return Number.parseFloat(value);
}

export type NumericFunction = (...args: readonly number[]) => number;

/**
 * Narrows an unknown module export (`ctx.moduleExports['lerp']`) to a callable numeric function
 * without a type assertion. Returns `null` when the export is not a function; a call whose result
 * is not a number returns `NaN`, so a wrong-shaped implementation fails numerically instead of
 * throwing mid-grade.
 */
export function numericFunction(value: unknown): NumericFunction | null {
  if (typeof value !== 'function') return null;
  return (...args: readonly number[]): number => {
    const result: unknown = Reflect.apply(value, undefined, [...args]);
    return typeof result === 'number' ? result : Number.NaN;
  };
}
