import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const POSITION_EPSILON_PX = 1;
const OPACITY_EPSILON = 0.05;

function bannerAnimation(ctx: GradeContext, banner: Element): Animation | null {
  return ctx.animations(banner).find((candidate) => candidate instanceof CSSAnimation) ?? null;
}

/**
 * Grades `accessibility/reduced-motion-swap` across BOTH media branches in one run:
 * `setReducedMotion` remounts with the flag forced, so each branch is asserted explicitly (the
 * grader never trusts the machine's real OS preference). Element references are re-queried after
 * every remount — the old ones go stale.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  await ctx.setReducedMotion(false);
  const banner = ctx.query('.banner');
  if (banner === null) {
    throw new Error('the grader needs the `.banner` element from the starter markup — keep the class name');
  }

  const motionAnimation = bannerAnimation(ctx, banner);
  ctx.expect(motionAnimation !== null, {
    message: 'With no motion preference, the banner has an entrance animation',
    hint: 'Keep the starter `slide-in` animation on `.banner` — the media query only overrides it.',
    actual: 'no CSS animation on .banner',
    expected: 'a running entrance animation',
  });
  if (motionAnimation === null) return;
  ctx.expect(ctx.timingOf(motionAnimation).duration === 500, {
    message: 'The default entrance runs 500ms',
    hint: 'Keep the starter duration; the reduced branch will inherit it.',
    actual: ctx.timingOf(motionAnimation).duration,
    expected: 500,
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(banner).e, 320, POSITION_EPSILON_PX * 4, {
    message: 'By default the banner starts 320px to the right',
    hint: 'The slide-in `from` frame is `transform: translateX(320px)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(banner, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'By default the banner fades in as it slides',
    hint: 'The `from` frame also carries `opacity: 0`.',
  });
  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(banner).e, 0, POSITION_EPSILON_PX, {
    message: 'The slide lands at the resting position',
    hint: 'The `to` frame ends at `translateX(0)`.',
  });

  await ctx.setReducedMotion(true);
  const calmBanner = ctx.query('.banner');
  if (calmBanner === null) {
    throw new Error('the banner disappeared after the reduced-motion remount — keep the markup unchanged');
  }

  const calmAnimation = bannerAnimation(ctx, calmBanner);
  ctx.expect(calmAnimation !== null, {
    message: 'Under reduced motion the banner STILL animates in — the feedback is not deleted',
    hint: 'Do not use `animation: none`. Swap `animation-name` to a fade inside `@media (prefers-reduced-motion: reduce)`.',
    actual: 'no CSS animation on .banner under reduced motion',
    expected: 'a calmer entrance animation',
  });
  if (calmAnimation === null) return;
  ctx.expect(ctx.timingOf(calmAnimation).duration === 500, {
    message: 'The reduced entrance keeps the same 500ms duration',
    hint: 'Override only `animation-name` in the media query — duration, easing, and fill inherit from the default rule.',
    actual: ctx.timingOf(calmAnimation).duration,
    expected: 500,
  });

  await ctx.time.seek(0);
  ctx.expectClose(pxNumber(ctx.computed(calmBanner, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'The reduced entrance is a fade: it starts transparent',
    hint: 'The fade keyframes go from `opacity: 0` to `opacity: 1`.',
  });
  ctx.expectClose(ctx.matrix(calmBanner).e, 0, POSITION_EPSILON_PX, {
    message: 'Under reduced motion the banner starts in place — no horizontal offset',
    hint: 'The fade keyframes must not touch `transform`.',
  });
  await ctx.time.seek(250);
  ctx.expectClose(ctx.matrix(calmBanner).e, 0, POSITION_EPSILON_PX, {
    message: 'Under reduced motion the banner never moves mid-entrance either',
    hint: 'If it moves at 250ms, the slide keyframes are still the active `animation-name` in the reduced branch.',
  });
  await ctx.time.settle();
  ctx.expectClose(pxNumber(ctx.computed(calmBanner, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'The reduced entrance ends fully visible',
    hint: 'The fade ends at `opacity: 1`, held by the inherited fill mode.',
  });
}
