import type { Challenge } from '@/challenges/types';
import type { ProgressRecord } from '@/data/records';

export interface SeriesProgress {
  solved: number;
  authored: number;
  siblings: readonly Challenge[];
}

/** Spec §4.2: "2 of 3 ways solved" plus sibling links. Counts authored members only. */
export function seriesProgressFor(
  challenge: Challenge,
  all: readonly Challenge[],
  progressById: ReadonlyMap<string, ProgressRecord>,
): SeriesProgress | null {
  const seriesId = challenge.series?.id;
  if (seriesId === undefined) return null;
  const members = all.filter((candidate) => candidate.series?.id === seriesId);
  const solved = members.filter((member) => progressById.get(member.id)?.status === 'solved').length;
  return {
    solved,
    authored: members.length,
    siblings: members.filter((member) => member.id !== challenge.id),
  };
}
