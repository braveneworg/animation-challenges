import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const ROTATION_EPSILON = 0.05;

function transitionPropertyOf(animation: Animation): string | null {
  return animation instanceof CSSTransition ? animation.transitionProperty : null;
}

/**
 * Grades `transforms-3d/card-flip`. Rotation is read through DOMMatrix components: for
 * rotateY(θ), m11 = cos θ — so resting is 1, mid-flip is near 0, and a full flip is −1. The back
 * face's permanent pre-rotation reads the same way at rest.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const scene = ctx.query('.scene');
  const card = ctx.query('.card');
  if (scene === null || card === null) {
    throw new Error(
      'the grader needs the `.scene` and `.card` elements from the starter markup — keep the class names',
    );
  }

  ctx.expect(ctx.computed(card, 'transform-style') === 'preserve-3d', {
    message: 'The card preserves 3D for its faces',
    hint: 'Without `transform-style: preserve-3d` on `.card`, the faces are flattened into a painted plane.',
    actual: ctx.computed(card, 'transform-style'),
    expected: 'preserve-3d',
  });

  const perspective = ctx.computed(scene, 'perspective');
  ctx.expect(perspective !== 'none' && pxNumber(perspective) > 0, {
    message: 'The scene supplies perspective',
    hint: 'Put `perspective: 800px` on `.scene` — on the parent, so the whole card shares one vanishing point.',
    actual: perspective,
    expected: 'a positive length, e.g. 800px',
  });

  const front = ctx.query('.front');
  const back = ctx.query('.back');
  ctx.expect(front !== null && ctx.computed(front, 'backface-visibility') === 'hidden', {
    message: 'The front face hides its reverse side',
    hint: 'Give `.face` (both faces) `backface-visibility: hidden`.',
    actual: front === null ? 'no .front element' : ctx.computed(front, 'backface-visibility'),
    expected: 'hidden',
  });
  ctx.expect(back !== null && ctx.computed(back, 'backface-visibility') === 'hidden', {
    message: 'The back face hides its reverse side',
    hint: '`backface-visibility: hidden` belongs on both faces, not just the front.',
    actual: back === null ? 'no .back element' : ctx.computed(back, 'backface-visibility'),
    expected: 'hidden',
  });
  if (back !== null) {
    const backMatrix = ctx.matrix(back);
    ctx.expect(Math.abs(backMatrix.m11 + 1) < ROTATION_EPSILON && Math.abs(backMatrix.m33 + 1) < ROTATION_EPSILON, {
      message: 'The back face is pre-rotated 180° so it reads correctly when shown',
      hint: 'Give `.back` a permanent `transform: rotateY(180deg)` — it never animates; the card does.',
      actual: `m11 ${backMatrix.m11.toFixed(2)}, m33 ${backMatrix.m33.toFixed(2)}`,
      expected: 'm11 ≈ −1 and m33 ≈ −1 (rotateY(180deg))',
    });
  }

  ctx.expectClose(ctx.matrix(card).m11, 1, ROTATION_EPSILON, {
    message: 'At rest the card faces forward',
    hint: 'The resting `.card` rule should not rotate — the flip lives in the hover rule.',
  });

  await ctx.hover(scene);

  const transition = ctx.animations(card).find((candidate) => transitionPropertyOf(candidate) === 'transform') ?? null;
  ctx.expect(transition !== null, {
    message: 'Hovering the scene starts a transition on the card',
    hint: 'Two rules: `transition: transform 600ms ease;` on `.card`, and `.scene:hover .card { transform: rotateY(180deg); }`.',
    actual: ctx.animations(card).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform',
  });
  if (transition === null) return;

  const duration = ctx.timingOf(transition).duration;
  const durationMs = typeof duration === 'number' ? duration : Number.NaN;
  ctx.expect(durationMs >= 350 && durationMs <= 850, {
    message: 'The flip takes roughly 600ms',
    hint: 'Give the transition a duration near 600ms — fast enough to feel responsive, slow enough to read as 3D.',
    actual: durationMs,
    expected: 'between 350ms and 850ms',
  });
  if (Number.isNaN(durationMs)) return;

  await ctx.time.seek(durationMs / 2);
  const midM11 = ctx.matrix(card).m11;
  ctx.expect(Math.abs(midM11) < 0.95, {
    message: 'Half-way through, the card is visibly turning',
    hint: 'If the card is already fully flipped mid-transition, the transition is missing from the resting `.card` rule.',
    actual: `m11 ${midM11.toFixed(2)} at ${Math.round(durationMs / 2)}ms`,
    expected: 'a value strictly between −0.95 and 0.95 (cos of a mid-flip angle)',
  });

  await ctx.time.seek(durationMs);
  ctx.expectClose(ctx.matrix(card).m11, -1, ROTATION_EPSILON, {
    message: 'The hover state is a full 180° flip',
    hint: 'The hover rule is `transform: rotateY(180deg)` — 90° would leave the card edge-on and invisible.',
  });
}
