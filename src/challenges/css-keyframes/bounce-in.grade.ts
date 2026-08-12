import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const SCALE_EPSILON = 0.02;
const OPACITY_EPSILON = 0.02;

/**
 * Grades `css-keyframes/bounce-in`: a `@keyframes bounce-in` entrance from scale(0.5)/opacity 0,
 * through scale(1.1) at 60%, to scale(1) — 500ms, once, end state held by the fill mode.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const badge = ctx.query('.badge');
  if (badge === null) {
    throw new Error('the grader needs the `.badge` element from the starter markup — keep the class name');
  }

  ctx.expect(ctx.hasKeyframesRule('bounce-in'), {
    message: 'A `@keyframes` rule named `bounce-in` exists',
    hint: 'Declare `@keyframes bounce-in { from { … } 60% { … } to { … } }` in styles.css.',
  });

  const animation =
    ctx
      .animations(badge)
      .find((candidate) => candidate instanceof CSSAnimation && candidate.animationName === 'bounce-in') ?? null;
  ctx.expect(animation !== null, {
    message: 'The badge is playing the `bounce-in` animation',
    hint: 'Bind the keyframes with the shorthand: `animation: bounce-in 500ms ease-out both;` on `.badge`.',
    actual: ctx.animations(badge).length === 0 ? 'no animations on .badge' : 'animations with other names only',
    expected: 'a CSS animation named `bounce-in`',
  });
  if (animation === null) return;

  const timing = ctx.timingOf(animation);
  ctx.expect(timing.duration === 500, {
    message: 'The animation runs for 500ms',
    hint: 'Set the duration in the shorthand: `animation: bounce-in 500ms …`.',
    actual: timing.duration,
    expected: 500,
  });
  ctx.expect(timing.iterations === 1, {
    message: 'The entrance plays exactly once',
    hint: 'An entrance is not a loop — leave `animation-iteration-count` at its default of 1.',
    actual: timing.iterations,
    expected: 1,
  });
  const fill = timing.fill ?? 'none';
  ctx.expect(fill === 'both' || fill === 'forwards', {
    message: 'The fill mode holds the final frame',
    hint: 'Without `animation-fill-mode: both` (or `forwards`) the badge snaps back when the animation ends.',
    actual: fill,
    expected: "'both' or 'forwards'",
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(badge).a, 0.5, SCALE_EPSILON, {
    message: 'At 0ms the badge is at half size',
    hint: 'The `from` frame is the pre-entrance state: `transform: scale(0.5)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'At 0ms the badge is fully transparent',
    hint: 'Put `opacity: 0` in the `from` frame alongside the scale.',
  });

  await ctx.time.seek(300);
  ctx.expectClose(ctx.matrix(badge).a, 1.1, SCALE_EPSILON, {
    message: 'At 300ms — the 60% mark — the badge reads scale(1.1)',
    hint: 'The overshoot is a keyframe: `60% { transform: scale(1.1); }`.',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(badge).a, 1, SCALE_EPSILON, {
    message: 'After the animation the badge rests at full size',
    hint: 'The `to` frame is `transform: scale(1)`, and the fill mode keeps it applied.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'After the animation the badge is fully opaque',
    hint: 'End at `opacity: 1` and hold it with the fill mode.',
  });
}
