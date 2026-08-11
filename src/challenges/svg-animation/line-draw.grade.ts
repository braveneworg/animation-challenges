import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const OFFSET_EPSILON = 8;

/**
 * Grades `svg-animation/line-draw`. Stroke values are numeric CSS properties (`pathLength="400"`
 * normalises the geometry), so the grader reads them with pxNumber at seeked times. The 450ms
 * read is exact because ease-in-out is symmetric: half time is half progress.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const line = ctx.query('.line');
  if (line === null) {
    throw new Error('the grader needs the `.line` path from the starter markup — keep the class name');
  }

  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dasharray')), 400, 1, {
    message: 'The dash pattern covers the whole 400-unit path',
    hint: '`stroke-dasharray: 400` — one dash (and one gap) as long as the entire line.',
  });

  const animation = ctx.animations(line).find((candidate) => candidate instanceof CSSAnimation) ?? null;
  ctx.expect(animation !== null, {
    message: 'A CSS animation is drawing the line',
    hint: 'Attach one with `animation: draw 900ms ease-in-out forwards;` on `.line`.',
    actual: ctx.animations(line).length === 0 ? 'no animations on .line' : 'only non-CSS animations',
    expected: 'a CSS animation on the path',
  });
  if (animation === null) return;

  ctx.expect(ctx.timingOf(animation).duration === 900, {
    message: 'The draw takes 900ms',
    hint: 'Set the duration in the shorthand: `animation: draw 900ms …`.',
    actual: ctx.timingOf(animation).duration,
    expected: 900,
  });
  ctx.expect(ctx.computed(line, 'animation-timing-function') === 'ease-in-out', {
    message: 'The draw eases in and out',
    hint: 'Use `ease-in-out` so the pen accelerates gently and lands gently.',
    actual: ctx.computed(line, 'animation-timing-function'),
    expected: 'ease-in-out',
  });
  const fill = ctx.timingOf(animation).fill ?? 'none';
  ctx.expect(fill === 'forwards' || fill === 'both', {
    message: 'The fill mode keeps the line drawn at the end',
    hint: 'Without `forwards`, the offset snaps back to 400 and the line vanishes again.',
    actual: fill,
    expected: "'forwards' or 'both'",
  });

  await ctx.time.seek(0);
  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dashoffset')), 400, OFFSET_EPSILON, {
    message: 'At 0ms the line is fully hidden — the offset pushes the dash out of view',
    hint: 'The resting style is `stroke-dashoffset: 400` (the animation only declares the `to` state).',
  });

  await ctx.time.seek(450);
  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dashoffset')), 200, OFFSET_EPSILON, {
    message: 'At 450ms — half time — the line is half drawn',
    hint: 'Animate the OFFSET to 0, not the dasharray: `@keyframes draw { to { stroke-dashoffset: 0; } }`.',
  });

  await ctx.time.settle();
  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dashoffset')), 0, 1, {
    message: 'After the animation the line is fully drawn and stays that way',
    hint: 'The `to` keyframe ends at `stroke-dashoffset: 0`, held by the forwards fill.',
  });
}
