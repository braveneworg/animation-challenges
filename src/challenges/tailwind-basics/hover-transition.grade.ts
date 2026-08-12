import type { GradeContext } from '@/sandbox/grade-context';
import { cssTransitionOn } from '@/sandbox/grader-utils';

const TRANSFORM_FAMILY = ['transform', 'translate', 'scale', 'rotate'];
const LIFT_PX = -6;

/**
 * Grades `tailwind-basics/hover-transition`. Movement is read through getBoundingClientRect deltas,
 * not `ctx.matrix`: Tailwind v4 may emit the individual `translate` property rather than
 * `transform`, and the rect reflects the composite of both. The transition itself is identified by
 * `CSSTransition.transitionProperty` membership in the transform family.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const card = ctx.query('.card');
  if (card === null) {
    throw new Error('the grader needs the `.card` element from the starter markup — keep the class name');
  }

  const restingTop = card.getBoundingClientRect().top;

  const properties = ctx
    .computed(card, 'transition-property')
    .split(',')
    .map((part) => part.trim());
  ctx.expect(!properties.includes('all'), {
    message: 'The transitioned properties are named — `transition-all` is not used',
    hint: 'Use `transition-transform`: `transition-all` animates every property that ever changes.',
    actual: properties.join(', '),
    expected: 'a list without `all`',
  });
  ctx.expect(
    properties.some((property) => TRANSFORM_FAMILY.includes(property)),
    {
      message: 'The transform family is opted into transitioning',
      hint: 'Add `transition-transform` to the card so the hover translate animates.',
      actual: properties.join(', '),
      expected: 'a list containing transform/translate/scale/rotate',
    },
  );

  await ctx.hover(card);

  const transition = cssTransitionOn(ctx.animations(card), TRANSFORM_FAMILY);
  ctx.expect(transition !== null, {
    message: 'Hovering starts a real transition on the transform family',
    hint: 'Three utilities together: `transition-transform duration-300 ease-out` on the card, plus `hover:-translate-y-1.5`.',
    actual: ctx.animations(card).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform/translate/scale/rotate',
  });
  if (transition === null) return;

  const duration = ctx.timingOf(transition).duration;
  ctx.expect(duration === 300, {
    message: 'The transition runs for 300ms',
    hint: 'That is the `duration-300` utility.',
    actual: duration,
    expected: 300,
  });

  const timingFunction = ctx.computed(card, 'transition-timing-function').replaceAll(' ', '');
  ctx.expect(timingFunction === 'ease-out' || timingFunction.startsWith('cubic-bezier(0,0,0.2,1)'), {
    message: 'The curve is `ease-out` — fast start, gentle landing',
    hint: 'Add the `ease-out` utility next to `duration-300`.',
    actual: timingFunction,
    expected: 'ease-out (cubic-bezier(0, 0, 0.2, 1))',
  });

  await ctx.time.seek(150);
  const midDelta = card.getBoundingClientRect().top - restingTop;
  ctx.expect(midDelta < -0.1 && midDelta > -5.9, {
    message: 'Half-way through, the card is between its two states — animating, not teleporting',
    hint: 'If the card is already fully lifted at 150ms, the transition utilities are missing and the translate applied instantly.',
    actual: `${midDelta.toFixed(2)}px at 150ms`,
    expected: 'strictly between 0 and -6px',
  });

  await ctx.time.seek(300);
  const endDelta = card.getBoundingClientRect().top - restingTop;
  ctx.expectClose(endDelta, LIFT_PX, 0.5, {
    message: 'The hover state lifts the card by exactly 6px',
    hint: '`hover:-translate-y-1.5` — 1.5 spacing steps × 4px = 6px, negative for up.',
  });
}
