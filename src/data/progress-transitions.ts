import type { ProgressRecord } from '@/data/records';

export function initialProgressRecord(challengeId: string, nowIso: string): ProgressRecord {
  return {
    id: challengeId,
    challengeId,
    status: 'unsolved',
    solveQuality: null,
    attempts: 0,
    hintsRevealed: 0,
    updatedAt: nowIso,
  };
}

export interface SubmitInput {
  passed: boolean;
  nowIso: string;
}

/**
 * Submit always counts the attempt. solveQuality is decided exactly once, at the first
 * passing submit: 'assisted' iff the solution had been viewed by then. A later failed
 * submit never downgrades a solve — only applyClear resets the record.
 */
export function applySubmit(record: ProgressRecord, input: SubmitInput): ProgressRecord {
  const base: ProgressRecord = {
    ...record,
    attempts: record.attempts + 1,
    lastAttemptAt: input.nowIso,
    updatedAt: input.nowIso,
  };
  if (!input.passed) {
    return record.status === 'solved' ? base : { ...base, status: 'attempted' };
  }
  if (record.firstSolvedAt !== undefined) {
    return { ...base, status: 'solved' };
  }
  return {
    ...base,
    status: 'solved',
    firstSolvedAt: input.nowIso,
    solveQuality: record.viewedSolutionAt !== undefined ? 'assisted' : 'clean',
  };
}

/** Hints never downgrade solve quality (spec §5.3): only the counter and updatedAt move. */
export function applyHintRevealed(record: ProgressRecord, nowIso: string): ProgressRecord {
  return { ...record, hintsRevealed: record.hintsRevealed + 1, updatedAt: nowIso };
}

/** Stamps viewedSolutionAt on the FIRST view; never blocks progress or invalidates a solve. */
export function applySolutionViewed(record: ProgressRecord, nowIso: string): ProgressRecord {
  return { ...record, viewedSolutionAt: record.viewedSolutionAt ?? nowIso, updatedAt: nowIso };
}

/**
 * Clear (spec §5.3): back to unsolved, keeping attempt history. viewedSolutionAt and
 * firstSolvedAt are dropped — that is what makes a clean re-solve genuinely upgrade.
 */
export function applyClear(record: ProgressRecord, nowIso: string): ProgressRecord {
  const cleared: ProgressRecord = {
    id: record.id,
    challengeId: record.challengeId,
    status: 'unsolved',
    solveQuality: null,
    attempts: record.attempts,
    hintsRevealed: 0,
    updatedAt: nowIso,
  };
  return record.lastAttemptAt === undefined ? cleared : { ...cleared, lastAttemptAt: record.lastAttemptAt };
}
