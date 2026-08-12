import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const SCALE_EPSILON = 0.02;
const OPACITY_EPSILON = 0.02;

/**
 * Grades `waapi/bounce-in`: the same entrance as the CSS series member, built with
 * `element.animate()` — no stylesheet keyframes, linear effect easing, forwards fill.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const badge = ctx.query('.badge');
  if (badge === null) {
    throw new Error('the grader needs the `.badge` element from the starter markup — keep the class name');
  }

  const keyframesRules = ctx.cssRules().filter((rule) => rule instanceof CSSKeyframesRule);
  ctx.expect(keyframesRules.length === 0, {
    message: 'The stylesheet declares no `@keyframes` — the entrance lives in JavaScript',
    hint: 'Delete any CSS animation; build the keyframes as an array passed to `badge.animate()`.',
    actual: `${keyframesRules.length} @keyframes rule(s) in the stylesheet`,
    expected: 'none',
  });

  const animation =
    ctx
      .animations(badge)
      .find((candidate) => !(candidate instanceof CSSAnimation) && !(candidate instanceof CSSTransition)) ?? null;
  ctx.expect(animation !== null, {
    message: 'A Web Animation created by `element.animate()` is running on the badge',
    hint: 'Call `badge.animate(keyframes, options)` from index.ts.',
    actual: ctx.animations(badge).length === 0 ? 'no animations on .badge' : 'only CSS-declared animations',
    expected: 'an animation created from JavaScript',
  });
  if (animation === null) return;

  const middleFrames = ctx
    .keyframesOf(animation)
    .filter((frame) => frame.computedOffset > 0 && frame.computedOffset < 1);
  ctx.expect(middleFrames.length >= 1, {
    message: 'A middle keyframe creates the overshoot',
    hint: 'Give the scale(1.1) frame `offset: 0.6` between the start and end keyframes.',
    actual: `${middleFrames.length} middle keyframe(s)`,
    expected: 'at least one keyframe strictly between offsets 0 and 1',
  });

  const timing = ctx.timingOf(animation);
  ctx.expect(timing.duration === 500, {
    message: 'The effect runs for 500ms',
    hint: 'Pass `duration: 500` in the options object.',
    actual: timing.duration,
    expected: 500,
  });
  ctx.expect(timing.easing === 'linear', {
    message: 'The effect easing is linear, so keyframe offsets map straight onto time',
    hint: "WAAPI's default is already linear — pass `easing: 'linear'` or omit it. (CSS `ease` is the CSS default, not the WAAPI one.)",
    actual: timing.easing,
    expected: 'linear',
  });
  const fill = timing.fill ?? 'none';
  ctx.expect(fill === 'forwards' || fill === 'both', {
    message: 'The fill holds the end state',
    hint: "Pass `fill: 'forwards'` — without it the badge snaps back to its static styles when the effect finishes.",
    actual: fill,
    expected: "'forwards' or 'both'",
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(badge).a, 0.5, SCALE_EPSILON, {
    message: 'At 0ms the badge is at half size',
    hint: 'The first keyframe is `{ transform: "scale(0.5)", opacity: 0 }`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'At 0ms the badge is fully transparent',
    hint: 'Put `opacity: 0` in the first keyframe.',
  });

  await ctx.time.seek(300);
  ctx.expectClose(ctx.matrix(badge).a, 1.1, SCALE_EPSILON, {
    message: 'At 300ms — offset 0.6 under linear easing — the badge reads scale(1.1)',
    hint: 'The overshoot frame is `{ transform: "scale(1.1)", opacity: 1, offset: 0.6 }`.',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(badge).a, 1, SCALE_EPSILON, {
    message: 'After the animation the badge rests at full size',
    hint: 'End the keyframe array at `scale(1)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'After the animation the badge is fully opaque',
    hint: 'End at `opacity: 1`, held by the forwards fill.',
  });
}
