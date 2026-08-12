import type { GradeContext } from '@/sandbox/grade-context';
import { forEachStep, pxNumber } from '@/sandbox/grader-utils';

/** 240 virtual frames = 4s at 60Hz — far beyond the reference spring's settling time (~0.8s). */
const SAMPLE_FRAMES = 240;
const SCALE_EPSILON = 0.02;
const OVERSHOOT_THRESHOLD = 1.02;

/** Effective uniform scale: the transform matrix times the individual `scale` property (if set). */
function scaleOf(ctx: GradeContext, el: Element): number {
  const individual = ctx.computed(el, 'scale');
  const parsed = individual === 'none' || individual === '' ? 1 : pxNumber(individual);
  const base = Number.isNaN(parsed) ? 1 : parsed;
  return base * ctx.matrix(el).a;
}

/**
 * Grades the auto-checkable portion of `motion-react-basics/bounce-in-spring` (hybrid): the badge
 * mounts at scale 0.5/opacity 0, overshoots past 1 under spring physics, and rests at exactly 1.
 * The perceptual half — how the spring FEELS — is the rubric's job, not this file's.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const badge = ctx.query('.badge');
  if (badge === null) {
    throw new Error('the grader needs a `.badge` element — keep the className on the motion element');
  }

  // The virtual clock has not ticked yet, so this IS the `initial` state.
  ctx.expectClose(scaleOf(ctx, badge), 0.5, 0.05, {
    message: 'Before the first animation frame the badge is at half size',
    hint: 'Give the motion element `initial={{ scale: 0.5, opacity: 0 }}` — the mounted, pre-entrance state.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 0, 0.05, {
    message: 'Before the first animation frame the badge is transparent',
    hint: 'Opacity belongs in `initial` too: the badge fades in while it scales.',
  });

  const samples: number[] = [];
  await forEachStep(SAMPLE_FRAMES, async () => {
    await ctx.time.stepFrames(1);
    samples.push(scaleOf(ctx, badge));
  });

  const peak = Math.max(...samples);
  ctx.expect(peak > OVERSHOOT_THRESHOLD, {
    message: 'The scale overshoots past 1 on the way in — spring physics at work',
    hint: "Use `transition={{ type: 'spring', stiffness: 260, damping: 12 }}`. A duration-based ease never crosses its target.",
    actual: `peak scale ${peak.toFixed(3)} over ${SAMPLE_FRAMES} frames`,
    expected: `a peak above ${OVERSHOOT_THRESHOLD}`,
  });

  const finalScale = samples.at(-1) ?? Number.NaN;
  ctx.expectClose(finalScale, 1, SCALE_EPSILON, {
    message: 'The badge comes to rest at exactly full size',
    hint: 'Animate to `scale: 1` in the `animate` prop and let the spring settle.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 1, SCALE_EPSILON, {
    message: 'The badge ends fully opaque',
    hint: 'Animate `opacity` to 1 alongside the scale.',
  });
}
