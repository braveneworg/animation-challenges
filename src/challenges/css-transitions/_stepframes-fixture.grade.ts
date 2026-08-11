import type { GradeContext } from '@/sandbox/grade-context';

/**
 * TEST FIXTURE, not a challenge grader. Reproduces the timer-sweep hazard directly (spec §6.7):
 * `ctx.time.stepFrames` paces its virtual frames through the harness's TRACKED `setTimeout`
 * (`installTimeController`'s own `nativeSetTimeout` is captured fresh inside `mount()`, which runs
 * AFTER the harness's timer-lifecycle wrapper is installed, so the pacing macrotask it schedules IS
 * one of the ids `resetStage()` sweeps). Used by both the `reset`- and `replay`-mid-grade tests in
 * `grade-timeout.browser.test.ts`, but the two guards fail differently under mutation, confirmed
 * empirically, and this fixture's own report only catches one of them:
 * - Under a broken `'reset'` guard, `resetStage()` nulls `installedTime` and leaves it null (`reset`
 *   does nothing else). The OBSERVED failure is `ctx.time`'s getter throwing "no time controller —
 *   the frame is between mounts" synchronously on the next line — an immediate rejection, not a
 *   hang — so THIS fixture's own report (`threw`) is what that test asserts against.
 * - Under a broken `'replay'` guard, `replay` re-enters `mount()`, which reinstalls a FRESH,
 *   valid `installedTime` almost synchronously (no `await` precedes `installTimeController`) —
 *   consistently faster than this fixture's own dynamic import resolves, so the grader ends up
 *   reading the fresh controller and reports a clean pass regardless of the guard. That test
 *   therefore does NOT rely on this fixture's report to detect the guard's absence; it counts the
 *   EXTRA `'mounted'` message the unguarded remount always posts instead.
 * With the guard intact in both cases, `reset`/`replay` is ignored and this assertion is recorded
 * normally. The leading underscore keeps it out of `graderIds`; `loadGrader` still resolves it by id.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  await ctx.time.stepFrames(30);
  ctx.expect(true, { message: 'recorded after stepFrames survives a concurrent reset', hint: 'fixture' });
}
