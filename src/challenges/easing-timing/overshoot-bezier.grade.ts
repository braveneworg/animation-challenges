import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 0.5;
const BEZIER_PATTERN = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/;

function transitionPropertyOf(animation: Animation): string | null {
  return animation instanceof CSSTransition ? animation.transitionProperty : null;
}

/**
 * Grades `easing-timing/overshoot-bezier`: a single hover transition whose cubic-bezier easing
 * carries the chip past 160px mid-flight and back to an exact landing. Overshoot is detected by
 * sampling the scrubbed transition at four times around the curve's peak.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const chip = ctx.query('.chip');
  if (chip === null) {
    throw new Error('the grader needs the `.chip` element from the starter markup — keep the class name');
  }

  await ctx.hover(chip);

  const transition = ctx.animations(chip).find((candidate) => transitionPropertyOf(candidate) === 'transform') ?? null;
  ctx.expect(transition !== null, {
    message: 'Hovering starts a transition on `transform`',
    hint: 'Keep the starter transition — only its timing function should change.',
    actual: ctx.animations(chip).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform',
  });
  if (transition === null) return;

  ctx.expect(
    ctx.animations(chip).every((candidate) => candidate instanceof CSSTransition),
    {
      message: 'The overshoot comes from the transition alone — no keyframe animation is layered on',
      hint: 'Delete any @keyframes: a y-control value above 1 in the cubic-bezier is the whole trick.',
      actual: 'a non-transition animation is running on the chip',
      expected: 'only CSS transitions',
    },
  );

  ctx.expect(ctx.timingOf(transition).duration === 400, {
    message: 'The slide runs over 400ms',
    hint: 'Keep the starter duration: `transition: transform 400ms …`.',
    actual: ctx.timingOf(transition).duration,
    expected: 400,
  });

  await ctx.time.seek(240);
  const sampleA = ctx.matrix(chip).e;
  await ctx.time.seek(270);
  const sampleB = ctx.matrix(chip).e;
  await ctx.time.seek(300);
  const sampleC = ctx.matrix(chip).e;
  await ctx.time.seek(330);
  const sampleD = ctx.matrix(chip).e;
  const peak = Math.max(sampleA, sampleB, sampleC, sampleD);
  ctx.expect(peak > 162, {
    message: 'Mid-flight the chip travels past its 160px destination',
    hint: 'Push an output control value above 1 — try `cubic-bezier(0.34, 1.56, 0.64, 1)`. The default `ease` never leaves the 0–1 range.',
    actual: `peak ${peak.toFixed(1)}px across samples at 240/270/300/330ms`,
    expected: 'a peak beyond 162px',
  });

  await ctx.time.seek(400);
  ctx.expectClose(ctx.matrix(chip).e, 160, POSITION_EPSILON_PX, {
    message: 'The chip lands exactly on translateX(160px)',
    hint: 'Overshoot is the journey, not the destination: the hover state stays `translateX(160px)`.',
  });

  const timingFunction = ctx.computed(chip, 'transition-timing-function');
  const parsed = BEZIER_PATTERN.exec(timingFunction);
  const y1 = parsed === null ? Number.NaN : Number.parseFloat(parsed[2] ?? '');
  const y2 = parsed === null ? Number.NaN : Number.parseFloat(parsed[4] ?? '');
  ctx.expect(y1 > 1 || y2 > 1, {
    message: 'The timing function is a custom cubic-bezier with an output value above 1',
    hint: 'Keyword easings (`ease`, `ease-out`, …) cannot overshoot; write `cubic-bezier(x1, y1, x2, y2)` with y1 or y2 > 1.',
    actual: timingFunction,
    expected: 'cubic-bezier(…) with y1 > 1 or y2 > 1',
  });
}
