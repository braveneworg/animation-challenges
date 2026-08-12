import type { Challenge, ChallengeFiles, RubricItem, RuntimeKind } from '@/challenges/types';
import type { SubmitOutcome } from '@/data/operations';
import {
  effectiveGraderTimeoutMs,
  summarizeReportFailures,
  toRunSummary,
  toSubmitOutcome,
} from '@/features/workspace/grade-report-mapping';
import type { RunGradeOptions } from '@/runner/run-grade';
import type { GradeRunReport, PrepareResult, TranspileDiagnostic } from '@/runner/types';
import type { RunSummary } from '@/stores/workspace-store';

export interface SubmitDeps {
  prepare(files: ChallengeFiles, runtime: RuntimeKind): Promise<PrepareResult>;
  runGrade(options: RunGradeOptions): Promise<GradeRunReport>;
  recordOutcome(outcome: SubmitOutcome): Promise<unknown>;
  nowIso(): string;
}

export interface SubmitInput {
  challenge: Challenge;
  files: ChallengeFiles;
  settingsTimeoutMs: number;
}

export type SubmitFlowResult =
  | { kind: 'transpile-error'; diagnostics: readonly TranspileDiagnostic[] }
  | { kind: 'graded'; report: GradeRunReport; summary: RunSummary; recorded: boolean };

/**
 * The Submit pipeline (spec §6.1), pure over its dependencies:
 * 1. prepare — a transpile failure surfaces diagnostics and records NO attempt (spec §6.7: no mount);
 * 2. runGrade — the settings-level timeout rides along as defaultTimeoutMs; per-challenge wins inside;
 * 3. map — Task 5's summarizer, so threw/timed-out runs always persist a "why";
 * 4. record — except for a hybrid grader PASS, which stays unrecorded until the rubric is confirmed
 *    (spec §2: hybrid must pass assertions AND confirm the rubric).
 */
export async function performSubmit(deps: SubmitDeps, input: SubmitInput): Promise<SubmitFlowResult> {
  const { challenge, files, settingsTimeoutMs } = input;
  const prepared = await deps.prepare(files, challenge.runtime);
  if (!prepared.ok) {
    return { kind: 'transpile-error', diagnostics: prepared.diagnostics };
  }
  const report = await deps.runGrade({ challenge, files, defaultTimeoutMs: settingsTimeoutMs });
  const failures = summarizeReportFailures(report, effectiveGraderTimeoutMs(challenge, settingsTimeoutMs));
  const summary = toRunSummary(report, failures, deps.nowIso());
  const deferForRubric = challenge.gradeMode === 'hybrid' && report.passed;
  if (!deferForRubric) {
    await deps.recordOutcome(toSubmitOutcome(report, failures));
  }
  return { kind: 'graded', report, summary, recorded: !deferForRubric };
}

export function rubricPassOutcome(challengeId: string, durationMs: number): SubmitOutcome {
  return { challengeId, passed: true, failures: [], durationMs };
}

const RUBRIC_FAIL_HINT = 'Compare your output with the target view, adjust, and self-assess again.';

export function rubricFailOutcome(
  challengeId: string,
  unchecked: readonly RubricItem[],
  durationMs: number,
): SubmitOutcome {
  return {
    challengeId,
    passed: false,
    failures: unchecked.map((item) => ({
      message: `Rubric item not confirmed: ${item.label}`,
      hint: item.detail ?? RUBRIC_FAIL_HINT,
    })),
    durationMs,
  };
}
