import { z } from 'zod';

import { CATEGORY_IDS, type CategoryId } from '@/challenges/categories';
import type { Challenge, Difficulty, Tech } from '@/challenges/types';
import type { ProgressRecord, ProgressStatus } from '@/data/records';

export const DIFFICULTIES = ['novice', 'intermediate', 'advanced', 'expert'] as const satisfies readonly Difficulty[];
export const TECHS = ['css', 'tailwind', 'ts', 'react', 'motion', 'svg', 'waapi'] as const satisfies readonly Tech[];
export const STATUSES = ['unsolved', 'attempted', 'solved'] as const satisfies readonly ProgressStatus[];

export interface CatalogSearch {
  q?: string | undefined;
  category?: CategoryId | undefined;
  difficulty?: Difficulty | undefined;
  tech?: Tech | undefined;
  status?: ProgressStatus | undefined;
  tag?: string | undefined;
}

// Every key carries .catch(undefined): a mangled URL degrades to "filter off", never a crash.
export const catalogSearchSchema: z.ZodType<CatalogSearch> = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  category: z.enum(CATEGORY_IDS).optional().catch(undefined),
  difficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  tech: z.enum(TECHS).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  tag: z.string().trim().min(1).optional().catch(undefined),
});

export function parseCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const result = catalogSearchSchema.safeParse(search);
  return result.success ? result.data : {};
}

export function challengeStatus(record: ProgressRecord | undefined): ProgressStatus {
  return record?.status ?? 'unsolved';
}

function matchesQuery(challenge: Challenge, query: string): boolean {
  const haystack = [challenge.title, challenge.id, ...challenge.tags].join(' ').toLowerCase();
  return haystack.includes(query);
}

/** Pure AND-combined predicate over the registry + progress join. */
export function filterChallenges(
  challenges: readonly Challenge[],
  search: CatalogSearch,
  progressById: ReadonlyMap<string, ProgressRecord>,
): Challenge[] {
  const query = search.q?.toLowerCase();
  return challenges.filter((challenge) => {
    if (search.category !== undefined && challenge.categoryId !== search.category) return false;
    if (search.difficulty !== undefined && challenge.difficulty !== search.difficulty) return false;
    if (search.tech !== undefined && !challenge.tech.includes(search.tech)) return false;
    if (search.tag !== undefined && !challenge.tags.includes(search.tag)) return false;
    if (search.status !== undefined && challengeStatus(progressById.get(challenge.id)) !== search.status) return false;
    if (query !== undefined && !matchesQuery(challenge, query)) return false;
    return true;
  });
}

export function allTags(challenges: readonly Challenge[]): string[] {
  return [...new Set(challenges.flatMap((challenge) => challenge.tags))].sort((a, b) => a.localeCompare(b));
}
