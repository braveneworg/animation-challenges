import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 2;

/**
 * Grades `raf-tweening/first-loop` with exact frame arithmetic: 15 virtual frames = 250ms = 150px
 * of a linear 500ms/300px tween; 30 frames = 500ms = 300px. `stepFrames(n)` yields exactly n
 * frames of motion (the baseline off-by-one is compensated inside the TimeController).
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const box = ctx.query('.box');
  if (box === null) {
    throw new Error('the grader needs the `.box` element from the starter markup — keep the class name');
  }

  ctx.expect(ctx.animations(box).length === 0, {
    message: 'No CSS transition or animation is involved — the movement is hand-driven',
    hint: 'Write `box.style.transform` from a requestAnimationFrame loop; do not reach for CSS animations here.',
    actual: `${ctx.animations(box).length} animation object(s) on .box`,
    expected: 'none',
  });

  ctx.expectClose(ctx.matrix(box).e, 0, POSITION_EPSILON_PX, {
    message: 'Before any frame the box is at its start',
    hint: 'The loop moves the box from translateX(0) — do not pre-position it.',
  });

  await ctx.time.stepFrames(15);
  ctx.expectClose(ctx.matrix(box).e, 150, POSITION_EPSILON_PX, {
    message: 'After 15 frames (250ms) the box sits at exactly 150px — half-way',
    hint: 'Progress is `(now - start) / 500`, with `start` captured from the FIRST rAF timestamp. If you are near 150 but drifting, you are mixing Date.now() with the rAF timestamp.',
  });

  await ctx.time.stepFrames(15);
  ctx.expectClose(ctx.matrix(box).e, 300, POSITION_EPSILON_PX, {
    message: 'After 30 frames (500ms) the box has arrived at exactly 300px',
    hint: 'Clamp progress with `Math.min(progress, 1)` so the final write lands exactly on 300px.',
  });

  await ctx.time.stepFrames(5);
  ctx.expectClose(ctx.matrix(box).e, 300, POSITION_EPSILON_PX, {
    message: 'The finished tween stays put — the loop stopped',
    hint: 'Only re-request a frame while `progress < 1`; a loop that keeps running keeps writing.',
  });

  ctx.expect(ctx.computed(box, 'left') === 'auto', {
    message: 'The movement comes from `transform`, not `left`',
    hint: 'Animating `left` re-runs layout every frame; write `transform: translateX(…)` instead.',
    actual: `left: ${ctx.computed(box, 'left')}`,
    expected: 'left: auto',
  });
}
