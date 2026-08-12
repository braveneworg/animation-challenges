import { DEFAULT_GRADER_TIMEOUT_MS, type Challenge } from '@/challenges/types';
import type { SubmitOutcome } from '@/data/operations';
import type { FailureSummary } from '@/data/records';
import type { GradeRunReport } from '@/runner/types';
import type { RunSummary } from '@/stores/workspace-store';

/**
 * Effective grader budget, exactly as Plan 02's contract states it: per-challenge override wins,
 * then the caller's settings-level default, then Plan 02's DEFAULT_GRADER_TIMEOUT_MS. This is the
 * only place the precedence is written; runGrade applies the same rule internally from the same
 * inputs, so the number shown in the timeout message always matches the budget that was enforced.
 */
export function effectiveGraderTimeoutMs(challenge: Challenge, settingsTimeoutMs: number | undefined): number {
  return challenge.graderTimeoutMs ?? settingsTimeoutMs ?? DEFAULT_GRADER_TIMEOUT_MS;
}

export function timeoutFailureSummary(timeoutMs: number): FailureSummary {
  return {
    message: `grading timed out after ${timeoutMs}ms`,
    hint: 'Look for animations that never settle and loops that never exit — the grader gave up waiting.',
  };
}

const THREW_HINT =
  'The grader stopped early on this error. Fix it and resubmit; any failures listed above were recorded before the stop.';

const NO_ASSERTIONS_FAILURE: FailureSummary = {
  message: 'The grader recorded no assertions',
  hint: 'A pass requires at least one recorded check. If your code prevented the grader from asserting anything, simplify and resubmit.',
};

/**
 * Maps a live GradeRunReport down to Plan 04's persistable FailureSummary[].
 * Seam obligations (Wave 1 review, binding):
 * - failing AssertionRecords map field-for-field with null -> undefined;
 * - a `threw` run appends a summary built from threw.message (transpile/mount/handshake failures and
 *   grader throws — including loop-guard trips, whose message already reads "possible infinite loop");
 * - a timed-out run appends the fixed timeout summary; a frame-side soft timeout keeps its partial
 *   assertions and gets the timeout summary appended after them;
 * - INVARIANT: a failed report never yields [] (the zero-assertion grader case is covered too).
 */
export function summarizeReportFailures(report: GradeRunReport, timeoutMs: number): FailureSummary[] {
  const failures: FailureSummary[] = report.assertions
    .filter((assertion) => !assertion.ok)
    .map((assertion) => ({
      message: assertion.message,
      hint: assertion.hint,
      actual: assertion.actual ?? undefined,
      expected: assertion.expected ?? undefined,
    }));
  if (report.threw !== null) {
    failures.push({ message: report.threw.message, hint: THREW_HINT });
  }
  if (report.timedOut) {
    failures.push(timeoutFailureSummary(timeoutMs));
  }
  if (!report.passed && failures.length === 0) {
    failures.push(NO_ASSERTIONS_FAILURE);
  }
  return failures;
}

export function toRunSummary(report: GradeRunReport, failures: FailureSummary[], completedAt: string): RunSummary {
  return { passed: report.passed, failures, durationMs: report.durationMs, completedAt };
}

export function toSubmitOutcome(report: GradeRunReport, failures: FailureSummary[]): SubmitOutcome {
  return { challengeId: report.challengeId, passed: report.passed, failures, durationMs: report.durationMs };
}
