import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 1;

/**
 * Grades `motion-core/first-animate`. motion's vanilla `animate()` drives transform values through
 * WAAPI, so the grader introspects the animation object and scrubs it deterministically with
 * `seek`. If rule 5 ever fails here with "no Web Animation on .box" for the reference solution,
 * the installed motion version stopped using WAAPI for transform strings — report it to the
 * coordinator rather than rewriting the goal.
 *
 * The leading `stepFrames(1)` is load-bearing, not cosmetic: motion's `DOMKeyframesResolver`
 * always defers the actual `element.animate()` call to its own internal frame-batcher (a `read`
 * then `resolveKeyframes` step scheduled via `requestAnimationFrame`), so the underlying Web
 * Animation does not exist yet in the same tick `animate()` returns — true in a real browser too,
 * not a virtual-clock artifact. Under the sandbox's virtual clock that scheduled step queues on
 * `VirtualClock` and only drains via `stepFrames`; `seek`/`settle` never call `clock.flush()`. Skip
 * this line and `ctx.animations(box)` reads empty even for the reference solution.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const box = ctx.query('.box');
  if (box === null) {
    throw new Error('the grader needs the `.box` element from the starter markup — keep the class name');
  }

  await ctx.time.stepFrames(1);
  const animation =
    ctx
      .animations(box)
      .find((candidate) => !(candidate instanceof CSSAnimation) && !(candidate instanceof CSSTransition)) ?? null;
  ctx.expect(animation !== null, {
    message: "motion's animate() is driving a real Web Animation on the box",
    hint: "Import `{ animate }` from 'motion' and call `animate('.box', { transform: 'translateX(240px)' }, options)`.",
    actual: ctx.animations(box).length === 0 ? 'no animations on .box' : 'only CSS-declared animations',
    expected: 'a script-created Web Animation',
  });
  if (animation === null) return;

  ctx.expect(ctx.timingOf(animation).duration === 1200, {
    message: 'The effect runs for 1.2 seconds',
    hint: 'motion counts in seconds: `duration: 1.2`. If your animation lasts 20 minutes, you passed milliseconds.',
    actual: ctx.timingOf(animation).duration,
    expected: 1200,
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(box).e, 0, POSITION_EPSILON_PX, {
    message: 'The slide starts from the resting position',
    hint: 'Animate TO translateX(240px); the starting state is where the box already is.',
  });

  await ctx.time.seek(600);
  const midway = ctx.matrix(box).e;
  ctx.expect(midway > 150 && midway < 239, {
    message: 'At half time the box is well past half distance — the ease-out curve front-loads speed',
    hint: "Pass `ease: 'easeOut'` in the options. Linear easing would read exactly 120px here.",
    actual: `${midway.toFixed(1)}px at 600ms`,
    expected: 'more than 150px, less than 239px',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(box).e, 240, POSITION_EPSILON_PX, {
    message: 'The box lands exactly on translateX(240px) and stays there',
    hint: 'motion holds the final value for you — if the box snaps back, the animation was cancelled.',
  });
}
