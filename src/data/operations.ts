import {
  applyClear,
  applyHintRevealed,
  applySolutionViewed,
  applySubmit,
  initialProgressRecord,
} from '@/data/progress-transitions';
import type { Attempt, FailureSummary, ProgressRecord } from '@/data/records';
import type { ProgressRepository } from '@/data/repository';

export interface OperationOptions {
  now?: (() => string) | undefined;
  createId?: (() => string) | undefined;
}

export interface SubmitOutcome {
  challengeId: string;
  passed: boolean;
  failures: FailureSummary[];
  durationMs: number;
}

export interface SubmitRecordResult {
  attempt: Attempt;
  progress: ProgressRecord;
}

function resolveNow(options?: OperationOptions): () => string {
  return options?.now ?? (() => new Date().toISOString());
}

function resolveCreateId(options?: OperationOptions): () => string {
  return options?.createId ?? (() => crypto.randomUUID());
}

async function currentRecord(repo: ProgressRepository, challengeId: string, nowIso: string): Promise<ProgressRecord> {
  const records = await repo.listProgress();
  return records.find((record) => record.challengeId === challengeId) ?? initialProgressRecord(challengeId, nowIso);
}

/** Submit (spec §5.3): record an Attempt AND update the ProgressRecord, atomically from the UI's view. */
export async function recordSubmitOutcome(
  repo: ProgressRepository,
  outcome: SubmitOutcome,
  options?: OperationOptions,
): Promise<SubmitRecordResult> {
  const nowIso = resolveNow(options)();
  const attempt = await repo.addAttempt({
    id: resolveCreateId(options)(),
    challengeId: outcome.challengeId,
    createdAt: nowIso,
    passed: outcome.passed,
    failures: outcome.failures,
    durationMs: outcome.durationMs,
  });
  const record = await currentRecord(repo, outcome.challengeId, nowIso);
  const progress = await repo.upsertProgress(applySubmit(record, { passed: outcome.passed, nowIso }));
  return { attempt, progress };
}

export async function recordHintRevealed(
  repo: ProgressRepository,
  challengeId: string,
  options?: OperationOptions,
): Promise<ProgressRecord> {
  const nowIso = resolveNow(options)();
  return repo.upsertProgress(applyHintRevealed(await currentRecord(repo, challengeId, nowIso), nowIso));
}

export async function recordSolutionViewed(
  repo: ProgressRepository,
  challengeId: string,
  options?: OperationOptions,
): Promise<ProgressRecord> {
  const nowIso = resolveNow(options)();
  return repo.upsertProgress(applySolutionViewed(await currentRecord(repo, challengeId, nowIso), nowIso));
}

export async function recordClear(
  repo: ProgressRepository,
  challengeId: string,
  options?: OperationOptions,
): Promise<ProgressRecord> {
  const nowIso = resolveNow(options)();
  return repo.upsertProgress(applyClear(await currentRecord(repo, challengeId, nowIso), nowIso));
}
