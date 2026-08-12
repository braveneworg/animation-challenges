import { queryOptions, type QueryClient } from '@tanstack/react-query';

import type { ProgressRepository } from '@/data/repository';

export const dataKeys = {
  all: ['data'] as const,
  progress: () => [...dataKeys.all, 'progress'] as const,
  attempts: (challengeId: string) => [...dataKeys.all, 'attempts', challengeId] as const,
  note: (challengeId: string) => [...dataKeys.all, 'note', challengeId] as const,
  profile: () => [...dataKeys.all, 'profile'] as const,
};

export function progressQueryOptions(repo: ProgressRepository) {
  return queryOptions({ queryKey: dataKeys.progress(), queryFn: () => repo.listProgress() });
}

export function attemptsQueryOptions(repo: ProgressRepository, challengeId: string) {
  return queryOptions({ queryKey: dataKeys.attempts(challengeId), queryFn: () => repo.listAttempts(challengeId) });
}

export function noteQueryOptions(repo: ProgressRepository, challengeId: string) {
  return queryOptions({ queryKey: dataKeys.note(challengeId), queryFn: () => repo.getNote(challengeId) });
}

export function profileQueryOptions(repo: ProgressRepository) {
  return queryOptions({ queryKey: dataKeys.profile(), queryFn: () => repo.getProfile() });
}

/** After a submit/hint/spoiler/clear mutation for one challenge. */
export async function invalidateChallengeData(queryClient: QueryClient, challengeId: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: dataKeys.progress() }),
    queryClient.invalidateQueries({ queryKey: dataKeys.attempts(challengeId) }),
    queryClient.invalidateQueries({ queryKey: dataKeys.note(challengeId) }),
  ]);
}

/** After sync() or reset-progress: everything under ['data'] refetches. */
export async function invalidateAllData(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: dataKeys.all });
}
