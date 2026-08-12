import type { GradeContext } from '@/sandbox/grade-context';
import { cssTransitionOn } from '@/sandbox/grader-utils';

const POSITION_EPSILON_PX = 0.5;

function durationOf(ctx: GradeContext, animation: Animation | null): number | null {
  if (animation === null) return null;
  const { duration } = ctx.timingOf(animation);
  return typeof duration === 'number' ? duration : null;
}

/**
 * Grades `css-transitions/hover-lift` against its three goals: (1) hover lifts the card 6px over
 * roughly 200ms, (2) the shadow deepens over the same period, (3) the movement uses `transform`
 * with explicitly named transition properties — never `all`, `top`, or `margin`.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const card = ctx.query('.card');
  if (card === null) {
    // Unrecoverable precondition (spec §6.5): every later assertion would be noise without the card.
    throw new Error('the grader needs the `.card` element from the starter markup — keep the class name on the card');
  }

  const restingShadow = ctx.computed(card, 'box-shadow');
  const restingMarginTop = ctx.computed(card, 'margin-top');

  ctx.expectClose(ctx.matrix(card).f, 0, POSITION_EPSILON_PX, {
    message: 'The card starts at its resting position',
    hint: 'The lift belongs inside `.card:hover` — the resting `.card` rule should not move the card.',
  });

  await ctx.hover(card);

  const transitions = ctx.animations(card);
  const describeTransitions =
    transitions
      .map((animation) =>
        animation instanceof CSSTransition ? animation.transitionProperty : 'non-transition animation',
      )
      .join(', ') || 'no animations at all';
  const transformTransition = cssTransitionOn(transitions, ['transform']);
  const shadowTransition = cssTransitionOn(transitions, ['box-shadow']);

  ctx.expect(transformTransition !== null, {
    message: 'Hovering starts a real transition on `transform`',
    hint: 'Declare `transition` on `.card` (the resting rule) and change `transform` inside `.card:hover`.',
    actual: describeTransitions,
    expected: 'a CSS transition on `transform`',
  });

  ctx.expect(shadowTransition !== null, {
    message: 'Hovering starts a real transition on `box-shadow`',
    hint: 'List `box-shadow` in the same `transition` declaration as `transform`.',
    actual: describeTransitions,
    expected: 'a CSS transition on `box-shadow`',
  });

  const duration = durationOf(ctx, transformTransition);
  ctx.expect(duration !== null && duration >= 100 && duration <= 400, {
    message: 'The lift runs over roughly 200ms',
    hint: 'Give the transition a duration near 200ms — e.g. `transition: transform 200ms, box-shadow 200ms;`.',
    actual: duration === null ? 'no transform transition' : `${duration}ms`,
    expected: 'a duration between 100ms and 400ms',
  });

  const midMs = duration === null ? 100 : duration / 2;
  await ctx.time.seek(midMs);
  ctx.expect(ctx.matrix(card).f <= -0.05, {
    message: 'Half-way through, the card has visibly started to move',
    hint: 'A transition animates BETWEEN states; if the card teleports, `transition` is missing from the resting rule.',
    actual: `translateY(${ctx.matrix(card).f}px) at ${midMs}ms`,
    expected: 'some upward movement before the transition ends',
  });

  await ctx.time.seek(duration ?? 200);
  ctx.expectClose(ctx.matrix(card).f, -6, POSITION_EPSILON_PX, {
    message: 'The hover state lifts the card by exactly 6px',
    hint: 'Use `transform: translateY(-6px)` in `.card:hover`.',
  });

  const hoverShadow = ctx.computed(card, 'box-shadow');
  ctx.expect(hoverShadow !== restingShadow, {
    message: 'The shadow deepens on hover',
    hint: 'Give `.card:hover` a larger `box-shadow`, and transition it.',
    actual: hoverShadow,
    expected: `anything other than the resting shadow (${restingShadow})`,
  });

  const transitionProperty = ctx.computed(card, 'transition-property');
  const propertyList = transitionProperty.split(',').map((part) => part.trim());
  ctx.expect(!propertyList.includes('all'), {
    message: 'The transitioned properties are named explicitly — never `all`',
    hint: '`transition: all` animates properties you never intended; name the two you mean.',
    actual: transitionProperty,
    expected: 'a list naming `transform` and `box-shadow`, without `all`',
  });

  ctx.expect(propertyList.includes('transform') && propertyList.includes('box-shadow'), {
    message: 'Both `transform` and `box-shadow` appear in the transitioned property list',
    hint: 'Separate multiple transitions with commas: `transition: transform 200ms, box-shadow 200ms;`.',
    actual: transitionProperty,
    expected: "a list containing 'transform' and 'box-shadow'",
  });

  ctx.expect(ctx.computed(card, 'top') === 'auto' && ctx.computed(card, 'margin-top') === restingMarginTop, {
    message: 'The movement comes from `transform`, not `top` or `margin`',
    hint: '`top` and `margin` changes re-run layout every frame; `transform` moves the card on the compositor.',
    actual: `top: ${ctx.computed(card, 'top')}, margin-top: ${ctx.computed(card, 'margin-top')}`,
    expected: `top: auto, margin-top: ${restingMarginTop}`,
  });
}
