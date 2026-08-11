import type { GradeContext } from '@/sandbox/grade-context';

/**
 * TEST FIXTURE, not a challenge grader. The leading underscore keeps it out of `graderIds`, so the
 * catalog suite never sees it; `loadGrader` still resolves it by id. It records two assertions and
 * then hangs forever — how the timeout tests prove a frame-side timeout still reports the
 * assertions already recorded (spec §6.7).
 */
export async function grade(ctx: GradeContext): Promise<void> {
  ctx.expect(true, { message: 'recorded before the hang (1 of 2)', hint: 'fixture' });
  ctx.expect(true, { message: 'recorded before the hang (2 of 2)', hint: 'fixture' });
  await new Promise<void>(() => undefined);
}
