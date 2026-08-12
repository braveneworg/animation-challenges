import { describe, expect, it } from 'vitest';

import { submitAnnouncement } from '@/features/workspace/announcements';

describe('submitAnnouncement', () => {
  it('announces a pass', () => {
    expect(submitAnnouncement({ passed: true, failures: [], durationMs: 100, completedAt: 'x' })).toBe(
      'Submission passed.',
    );
  });

  it('announces failure counts with plural handling', () => {
    const failure = { message: 'm', hint: 'h' };
    expect(submitAnnouncement({ passed: false, failures: [failure], durationMs: 100, completedAt: 'x' })).toBe(
      'Submission failed: 1 issue. Open the Results tab for details.',
    );
    expect(submitAnnouncement({ passed: false, failures: [failure, failure], durationMs: 100, completedAt: 'x' })).toBe(
      'Submission failed: 2 issues. Open the Results tab for details.',
    );
  });
});
