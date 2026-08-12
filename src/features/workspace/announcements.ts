import type { RunSummary } from '@/stores/workspace-store';

/** Text for the workspace's polite live region — announced on every recorded submit. */
export function submitAnnouncement(summary: RunSummary): string {
  if (summary.passed) return 'Submission passed.';
  const count = summary.failures.length;
  return `Submission failed: ${count} ${count === 1 ? 'issue' : 'issues'}. Open the Results tab for details.`;
}
