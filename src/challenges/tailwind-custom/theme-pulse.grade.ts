import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const SCALE_EPSILON = 0.02;
const OPACITY_EPSILON = 0.02;

/**
 * Grades `tailwind-custom/theme-pulse` — and, deliberately, pressure-tests the sandbox's Tailwind
 * readiness path: every assertion below reads state that exists ONLY if `@tailwindcss/browser`
 * JIT-compiled the user's `@theme` token after injection (the keyframes rule, the running
 * animation, the animated computed styles). If the compile-wait were broken, the reference
 * solution itself would fail rule 5.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const dot = ctx.query('.dot');
  if (dot === null) {
    throw new Error('the grader needs the `.dot` element from the starter markup — keep the class name');
  }

  const themeSource = ctx.source('theme.css');
  ctx.expect(themeSource.includes('@theme') && themeSource.includes('--animate-pulse-ring'), {
    message: 'theme.css declares the `--animate-pulse-ring` token inside a `@theme` block',
    hint: 'The utility in the markup only exists once the theme token does: `@theme { --animate-pulse-ring: …; }`.',
  });

  ctx.expect(ctx.hasKeyframesRule('pulse-ring'), {
    message: 'Tailwind generated the `pulse-ring` keyframes from the theme',
    hint: 'Define `@keyframes pulse-ring` inside the `@theme` block; it is emitted when `animate-pulse-ring` uses it.',
  });

  const animation =
    ctx
      .animations(dot)
      .find((candidate) => candidate instanceof CSSAnimation && candidate.animationName === 'pulse-ring') ?? null;
  ctx.expect(animation !== null, {
    message: 'The dot is running the `pulse-ring` animation',
    hint: 'Token and utility must match exactly: `--animate-pulse-ring` generates `animate-pulse-ring`.',
    actual: ctx.animations(dot).length === 0 ? 'no animations on .dot' : 'animations with other names only',
    expected: 'a CSS animation named `pulse-ring`',
  });
  if (animation === null) return;

  const timing = ctx.timingOf(animation);
  ctx.expect(timing.duration === 1200, {
    message: 'One pulse cycle lasts 1200ms',
    hint: 'The duration lives in the token value: `pulse-ring 1200ms ease-in-out infinite`.',
    actual: timing.duration,
    expected: 1200,
  });
  ctx.expect(timing.iterations === Infinity, {
    message: 'The pulse repeats forever',
    hint: 'End the token value with `infinite`.',
    actual: timing.iterations,
    expected: 'Infinity',
  });
  ctx.expect(ctx.computed(dot, 'animation-timing-function') === 'ease-in-out', {
    message: 'The pulse eases in and out',
    hint: 'Put `ease-in-out` in the token value between the duration and `infinite`.',
    actual: ctx.computed(dot, 'animation-timing-function'),
    expected: 'ease-in-out',
  });

  await ctx.time.seek(600);
  ctx.expectClose(ctx.matrix(dot).a, 1.25, SCALE_EPSILON, {
    message: 'At the cycle midpoint the dot is scaled to 1.25',
    hint: 'The 50% keyframe is `transform: scale(1.25)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(dot, 'opacity')), 0.6, OPACITY_EPSILON, {
    message: 'At the cycle midpoint the dot fades to 0.6 opacity',
    hint: 'Put `opacity: 0.6` in the 50% keyframe alongside the scale.',
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(dot).a, 1, SCALE_EPSILON, {
    message: 'At the cycle boundary the dot is back to normal size',
    hint: 'Group the resting frames: `0%, 100% { transform: scale(1); opacity: 1; }`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(dot, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'At the cycle boundary the dot is fully opaque',
    hint: 'The 0%/100% frames end at `opacity: 1`.',
  });
}
