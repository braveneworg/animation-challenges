import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import type { Challenge, ChallengeFiles, RubricItem, RuntimeKind } from '@/challenges/types';
import { recordSubmitOutcome } from '@/data/operations';
import { invalidateChallengeData } from '@/data/queries';
import { submitAnnouncement } from '@/features/workspace/announcements';
import { performSubmit, rubricFailOutcome, rubricPassOutcome, type SubmitDeps } from '@/features/workspace/submit-flow';
import { runGrade } from '@/runner/run-grade';
import type { GradeRunReport, PrepareResult, TranspileDiagnostic } from '@/runner/types';
import { useSettingsStore, useWorkspaceStore } from '@/stores';

// Both interfaces below use property-style function types (not method shorthand): destructuring a
// method-shorthand signature trips oxlint's type-aware `typescript/unbound-method` (the callback
// has no `this` to lose, but the rule can't tell method syntax from a real method) — the same
// convention already established for EditorPane/OutputPane callback props.
export interface UseSubmitOptions {
  challenge: Challenge;
  getFiles: () => ChallengeFiles;
  prepare: (files: ChallengeFiles, runtime: RuntimeKind) => Promise<PrepareResult>;
}

export interface SubmitApi {
  running: boolean;
  report: GradeRunReport | null;
  diagnostics: readonly TranspileDiagnostic[];
  awaitingRubric: boolean;
  announcement: string;
  submit: () => void;
  confirmRubric: () => void;
  recordRubricFail: (unchecked: readonly RubricItem[]) => void;
}

const EMPTY_DIAGNOSTICS: readonly TranspileDiagnostic[] = [];

/** Thin binding of the pure submit flow (Task 6) to runGrade, the repository, and the stores. */
export function useSubmit({ challenge, getFiles, prepare }: UseSubmitOptions): SubmitApi {
  const repo = useProgressRepository();
  const queryClient = useQueryClient();
  const setLastRunResult = useWorkspaceStore((state) => state.setLastRunResult);
  const graderTimeoutMs = useSettingsStore((state) => state.settings.graderTimeoutMs);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<GradeRunReport | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly TranspileDiagnostic[]>(EMPTY_DIAGNOSTICS);
  const [awaitingRubric, setAwaitingRubric] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const deps: SubmitDeps = useMemo(
    () => ({
      prepare,
      runGrade,
      recordOutcome: async (outcome) => {
        await recordSubmitOutcome(repo, outcome);
        await invalidateChallengeData(queryClient, outcome.challengeId);
      },
      nowIso: () => new Date().toISOString(),
    }),
    [prepare, repo, queryClient],
  );

  const submit = useCallback((): void => {
    if (running) return;
    setRunning(true);
    setDiagnostics(EMPTY_DIAGNOSTICS);
    setAnnouncement('Grading your submission…');
    void performSubmit(deps, { challenge, files: getFiles(), settingsTimeoutMs: graderTimeoutMs })
      .then((result) => {
        // promise/always-return: every path through this callback returns explicitly (undefined
        // either way) rather than mixing an early bare `return;` with an implicit fall-through —
        // a behavior-neutral restructure of the brief's literal early-return guard (same pattern
        // already used in use-preview-frame.ts).
        if (result.kind === 'transpile-error') {
          setDiagnostics(result.diagnostics);
          setReport(null);
          setAwaitingRubric(false);
          const count = result.diagnostics.length;
          setAnnouncement(
            `Submit blocked: ${count} syntax ${count === 1 ? 'error' : 'errors'}. No attempt was recorded.`,
          );
          return undefined;
        }
        setReport(result.report);
        setLastRunResult(result.summary);
        setAwaitingRubric(!result.recorded && result.report.passed);
        setAnnouncement(
          result.recorded
            ? submitAnnouncement(result.summary)
            : 'Checks passed. Confirm the rubric in the Results tab to record the solve.',
        );
        return undefined;
      })
      .catch((error: unknown) => {
        console.error('submit failed', error);
        setAnnouncement('Submit failed unexpectedly. Try again.');
      })
      .finally(() => setRunning(false));
  }, [challenge, deps, getFiles, graderTimeoutMs, running, setLastRunResult]);

  const confirmRubric = useCallback((): void => {
    const durationMs = report?.durationMs ?? 0;
    void deps
      .recordOutcome(rubricPassOutcome(challenge.id, durationMs))
      .then(() => {
        // promise/always-return: an explicit return keeps every path through this callback
        // returning a value, matching the pattern already used in use-preview-frame.ts.
        setLastRunResult({ passed: true, failures: [], durationMs, completedAt: new Date().toISOString() });
        setAwaitingRubric(false);
        setAnnouncement('Recorded as solved (self-assessed).');
        return undefined;
      })
      .catch((error: unknown) => console.error('failed to record rubric pass', error));
  }, [challenge.id, deps, report, setLastRunResult]);

  const recordRubricFail = useCallback(
    (unchecked: readonly RubricItem[]): void => {
      const outcome = rubricFailOutcome(challenge.id, unchecked, report?.durationMs ?? 0);
      void deps
        .recordOutcome(outcome)
        .then(() => {
          const summary = {
            passed: false,
            failures: outcome.failures,
            durationMs: outcome.durationMs,
            completedAt: new Date().toISOString(),
          };
          setLastRunResult(summary);
          setAwaitingRubric(false);
          setAnnouncement(submitAnnouncement(summary));
          return undefined;
        })
        .catch((error: unknown) => console.error('failed to record rubric outcome', error));
    },
    [challenge.id, deps, report, setLastRunResult],
  );

  return { running, report, diagnostics, awaitingRubric, announcement, submit, confirmRubric, recordRubricFail };
}
