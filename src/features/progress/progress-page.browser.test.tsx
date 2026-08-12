import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/app-harness';

describe('ProgressPage', () => {
  it('shows stats, series completion, and expandable attempt history with persisted failures', async () => {
    const { repository } = renderApp({ path: '/progress' });
    await screen.findByRole('heading', { name: /progress/i });
    await repository.upsertProgress({
      id: 'css-transitions/hover-lift',
      challengeId: 'css-transitions/hover-lift',
      status: 'attempted',
      solveQuality: null,
      attempts: 1,
      hintsRevealed: 1,
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await repository.addAttempt({
      id: 'attempt-1',
      challengeId: 'css-transitions/hover-lift',
      createdAt: new Date().toISOString(),
      passed: false,
      failures: [{ message: 'grading timed out after 5000ms', hint: 'Check for animations that never settle.' }],
      durationMs: 5100,
    });
    // Unmount the first app before the fresh mount (global cleanup only runs between tests):
    cleanup();
    renderApp({ path: '/progress', repository });
    const toggle = await screen.findByRole('button', { name: /hover lift/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText('grading timed out after 5000ms')).toBeTruthy());
    expect(screen.getByText(/check for animations that never settle/i)).toBeTruthy();
    expect(screen.getByText(/1 hint used/i)).toBeTruthy();
    expect(screen.getByText(/bounce-in/i)).toBeTruthy();
    // Binding decision (spec §2 / global-constraints.md): attempt history rows badge the grade mode.
    expect(screen.getByText(/auto-graded/i)).toBeTruthy();
  });

  it('renders an empty state before any attempts', async () => {
    renderApp({ path: '/progress' });
    expect(await screen.findByText(/no attempts yet/i)).toBeTruthy();
  });
});
