import { TOTAL_PLANNED_CHALLENGES, type Category, type CategoryId } from '@/challenges/categories';
import type { Series, SeriesId } from '@/challenges/series';
import type { Challenge } from '@/challenges/types';
import type { ProgressRecord } from '@/data/records';

export interface CategorySummary {
  categoryId: CategoryId;
  title: string;
  authored: number;
  solved: number;
  plannedCount: number;
}

export interface CompletionSummary {
  solved: number;
  authored: number;
  planned: number;
}

export interface SeriesSummary {
  id: SeriesId;
  label: string;
  authored: number;
  solved: number;
  plannedMembers: number;
}

export interface SolveQualityCounts {
  clean: number;
  assisted: number;
}

function isSolved(record: ProgressRecord | undefined): boolean {
  return record?.status === 'solved';
}

export function overallCompletion(
  challenges: readonly Challenge[],
  progressById: ReadonlyMap<string, ProgressRecord>,
): CompletionSummary {
  const solved = challenges.filter((challenge) => isSolved(progressById.get(challenge.id))).length;
  return { solved, authored: challenges.length, planned: TOTAL_PLANNED_CHALLENGES };
}

export function summarizeCategories(
  categories: readonly Category[],
  challenges: readonly Challenge[],
  progressById: ReadonlyMap<string, ProgressRecord>,
): CategorySummary[] {
  return categories.map((category) => {
    const members = challenges.filter((challenge) => challenge.categoryId === category.id);
    return {
      categoryId: category.id,
      title: category.title,
      authored: members.length,
      solved: members.filter((member) => isSolved(progressById.get(member.id))).length,
      plannedCount: category.plannedCount,
    };
  });
}

/** The newest in-flight (attempted, not solved) challenge — "continue where you left off". */
export function continueChallenge(
  challenges: readonly Challenge[],
  progressList: readonly ProgressRecord[],
): Challenge | null {
  const byId = new Map(challenges.map((challenge) => [challenge.id, challenge]));
  const inFlight = progressList
    .filter(
      (record) => record.status === 'attempted' && record.lastAttemptAt !== undefined && byId.has(record.challengeId),
    )
    .sort((a, b) => (b.lastAttemptAt ?? '').localeCompare(a.lastAttemptAt ?? ''));
  const newest = inFlight[0];
  return newest === undefined ? null : (byId.get(newest.challengeId) ?? null);
}

/** Lowest solved/authored ratio among categories with authored work remaining; ties break to fewer solves, then input order. */
export function weakestCategory(summaries: readonly CategorySummary[]): CategorySummary | null {
  const candidates = summaries.filter((summary) => summary.authored > 0 && summary.solved < summary.authored);
  let weakest: CategorySummary | null = null;
  for (const candidate of candidates) {
    if (weakest === null) {
      weakest = candidate;
      continue;
    }
    const candidateRatio = candidate.solved / candidate.authored;
    const weakestRatio = weakest.solved / weakest.authored;
    if (candidateRatio < weakestRatio || (candidateRatio === weakestRatio && candidate.solved < weakest.solved)) {
      weakest = candidate;
    }
  }
  return weakest;
}

export function summarizeSeries(
  seriesList: readonly Series[],
  challenges: readonly Challenge[],
  progressById: ReadonlyMap<string, ProgressRecord>,
): SeriesSummary[] {
  return seriesList.map((series) => {
    const members = challenges.filter((challenge) => challenge.series?.id === series.id);
    return {
      id: series.id,
      label: series.label,
      authored: members.length,
      solved: members.filter((member) => isSolved(progressById.get(member.id))).length,
      plannedMembers: series.plannedMembers,
    };
  });
}

export function solveQualityCounts(progressList: readonly ProgressRecord[]): SolveQualityCounts {
  return {
    clean: progressList.filter((record) => record.solveQuality === 'clean').length,
    assisted: progressList.filter((record) => record.solveQuality === 'assisted').length,
  };
}
