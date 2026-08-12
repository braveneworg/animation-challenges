import type { GradeContext } from '@/sandbox/grade-context';
import { numericFunction } from '@/sandbox/grader-utils';

const EPSILON = 1e-9;

/**
 * Grades `easing-math/lerp` numerically: the grader calls the user's exported functions directly
 * (`runtime: 'module'` — spec §4: "this lane is where auto grading is fully honest").
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const lerp = numericFunction(ctx.moduleExports['lerp']);
  const inverseLerp = numericFunction(ctx.moduleExports['inverseLerp']);

  ctx.expect(lerp !== null, {
    message: '`lerp` is exported as a function from index.ts',
    hint: 'Keep the starter export: `export function lerp(a: number, b: number, t: number): number`.',
  });
  ctx.expect(inverseLerp !== null, {
    message: '`inverseLerp` is exported as a function from index.ts',
    hint: 'Keep the starter export: `export function inverseLerp(a: number, b: number, value: number): number`.',
  });
  if (lerp === null || inverseLerp === null) return;

  ctx.expectClose(lerp(0, 10, 0), 0, EPSILON, {
    message: '`lerp(0, 10, 0)` returns the start of the range',
    hint: 'At t = 0 the result is exactly `a`: start from `a` and add a scaled distance.',
  });
  ctx.expectClose(lerp(0, 10, 1), 10, EPSILON, {
    message: '`lerp(0, 10, 1)` returns the end of the range',
    hint: 'At t = 1 the whole distance `b - a` has been added.',
  });
  ctx.expectClose(lerp(10, 20, 0.5), 15, EPSILON, {
    message: '`lerp(10, 20, 0.5)` is the midpoint, 15',
    hint: 'The formula is `a + (b - a) * t` — check which distance you are scaling.',
  });
  ctx.expectClose(lerp(-4, 4, 0.75), 2, EPSILON, {
    message: '`lerp(-4, 4, 0.75)` handles a negative-to-positive range',
    hint: '`a + (b - a) * t` needs no special cases for sign — if this fails, you special-cased something.',
  });
  ctx.expectClose(lerp(0, 10, 1.5), 15, EPSILON, {
    message: '`lerp` extrapolates beyond t = 1 instead of clamping',
    hint: 'Do not clamp t. Springs overshoot through t > 1; clamping belongs to callers.',
  });

  ctx.expectClose(inverseLerp(10, 20, 15), 0.5, EPSILON, {
    message: '`inverseLerp(10, 20, 15)` is 0.5',
    hint: 'How far is `value` from `a`, as a share of the whole distance `b - a`?',
  });
  ctx.expectClose(inverseLerp(5, 15, 5), 0, EPSILON, {
    message: '`inverseLerp` returns 0 at the start of the range',
    hint: 'When `value === a` the numerator `value - a` is zero.',
  });
  ctx.expectClose(inverseLerp(5, 15, 15), 1, EPSILON, {
    message: '`inverseLerp` returns 1 at the end of the range',
    hint: 'When `value === b` the share is the whole distance.',
  });
  ctx.expectClose(inverseLerp(0, 10, -5), -0.5, EPSILON, {
    message: '`inverseLerp` extrapolates below the range instead of clamping',
    hint: 'A value before `a` is a negative fraction — leave it negative.',
  });
  ctx.expectClose(inverseLerp(2, 8, lerp(2, 8, 0.3)), 0.3, EPSILON, {
    message: '`inverseLerp(a, b, lerp(a, b, t))` round-trips to t',
    hint: 'If the round-trip drifts, one function scales by `b - a` and the other by something else.',
  });
}
