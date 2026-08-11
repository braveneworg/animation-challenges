import type { GradeContext } from '@/sandbox/grade-context';

/**
 * TEST FIXTURE, not a challenge grader. Reproduces the timer-sweep hazard directly (spec §6.7):
 * `ctx.time.stepFrames` paces its virtual frames through the harness's TRACKED `setTimeout`
 * (`installTimeController`'s own `nativeSetTimeout` is captured fresh inside `mount()`, which runs
 * AFTER the harness's timer-lifecycle wrapper is installed, so the pacing macrotask it schedules IS
 * one of the ids `resetStage()` sweeps). Under a broken `gradeInFlight` guard, a `reset` arriving
 * while this `await` is pending would cancel that pacing timer and hang this grader forever instead
 * of completing; with the guard intact, the `reset` is ignored and this assertion is recorded. The
 * leading underscore keeps it out of `graderIds`; `loadGrader` still resolves it by id.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  await ctx.time.stepFrames(30);
  ctx.expect(true, { message: 'recorded after stepFrames survives a concurrent reset', hint: 'fixture' });
}
