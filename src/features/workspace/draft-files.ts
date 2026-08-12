import type { ChallengeFiles } from '@/challenges/types';

/** §6.6 autosave backstop cadence: drafts persist shortly after every keystroke. */
export const DRAFT_SAVE_DEBOUNCE_MS = 300;

/**
 * The store only holds files the user has actually edited (setDraftFile is per-path), so the
 * working set is always starter ∪ drafts with drafts winning per file.
 */
export function mergedDraftFiles(
  starter: ChallengeFiles,
  drafts: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  return { ...starter, ...(drafts ?? {}) };
}
