import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 2;

function transformTransition(ctx: GradeContext, el: Element): Animation | null {
  return (
    ctx
      .animations(el)
      .find((candidate) => candidate instanceof CSSTransition && candidate.transitionProperty === 'transform') ?? null
  );
}

/**
 * Grades `interruption-state/reversible-hover`. The "no snap" proof is mechanical: after
 * interrupting mid-flight, the freshly retargeted return transition is scrubbed to ITS time 0 —
 * which reads the value the browser retargeted FROM. If that equals the interruption point, the
 * reversal is smooth by construction; the starter (transition declared inside :hover) has no
 * return transition at all and teleports.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const track = ctx.query('.track');
  const knob = ctx.query('.knob');
  if (track === null || knob === null) {
    throw new Error(
      'the grader needs the `.track` and `.knob` elements from the starter markup — keep the class names',
    );
  }

  // Phase 1: a full round trip.
  await ctx.hover(track);
  const outbound = transformTransition(ctx, knob);
  ctx.expect(outbound !== null, {
    message: 'Hovering starts a transition on the knob',
    hint: 'The knob needs a `transition: transform 600ms linear;` — check WHERE it is declared.',
    actual: ctx.animations(knob).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform',
  });
  if (outbound !== null) {
    ctx.expect(ctx.timingOf(outbound).duration === 600, {
      message: 'The slide runs over 600ms',
      hint: 'Keep the 600ms linear timing from the starter.',
      actual: ctx.timingOf(outbound).duration,
      expected: 600,
    });
  }
  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(knob).e, 120, POSITION_EPSILON_PX, {
    message: 'The hovered knob rests 120px to the right',
    hint: 'The hover rule is `transform: translateX(120px)`.',
  });

  await ctx.unhover(track);
  const inbound = transformTransition(ctx, knob);
  ctx.expect(inbound !== null, {
    message: 'Leaving hover ALSO animates — the return is a transition, not a teleport',
    hint: 'Declared inside `.track:hover .knob`, the transition vanishes with the hover. Move it to the resting `.knob` rule.',
    actual: inbound === null ? 'no transition after unhover — the knob snapped home' : 'found',
    expected: 'a CSS transition on transform for the return trip',
  });
  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(knob).e, 0, POSITION_EPSILON_PX, {
    message: 'The return trip lands back at the start',
    hint: 'The resting state is `translateX(0)` — no leftover offset.',
  });

  // Phase 2: interrupt mid-flight.
  await ctx.hover(track);
  await ctx.time.seek(300);
  ctx.expectClose(ctx.matrix(knob).e, 60, POSITION_EPSILON_PX, {
    message: 'Mid-flight (300ms of 600ms, linear) the knob is at 60px',
    hint: 'Linear timing makes mid-flight predictable — keep `linear` from the starter.',
  });

  await ctx.unhover(track);
  const reversal = transformTransition(ctx, knob);
  ctx.expect(reversal !== null, {
    message: 'Interrupting mid-flight starts a return transition',
    hint: 'With the transition on the resting rule, the browser retargets automatically — no JS needed.',
    actual: reversal === null ? 'no transition after the mid-flight unhover' : 'found',
    expected: 'a retargeted CSS transition',
  });
  if (reversal === null) return;

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(knob).e, 60, POSITION_EPSILON_PX, {
    message: 'The return starts from exactly where the knob was interrupted — no snap to either end',
    hint: 'CSS retargets transitions from the CURRENT computed value; if this reads 0 or 120, the return was not a transition at all.',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(knob).e, 0, POSITION_EPSILON_PX, {
    message: 'After the interrupted reversal the knob settles home',
    hint: 'No cleanup required — the retargeted transition finishes at the resting state on its own.',
  });

  ctx.expect(ctx.computed(knob, 'left') === 'auto' && ctx.computed(knob, 'margin-left') === '0px', {
    message: 'The movement comes from `transform` alone',
    hint: '`left`/`margin` animations re-run layout and do not retarget as cleanly — keep the translateX.',
    actual: `left: ${ctx.computed(knob, 'left')}, margin-left: ${ctx.computed(knob, 'margin-left')}`,
    expected: 'left: auto, margin-left: 0px',
  });
}
