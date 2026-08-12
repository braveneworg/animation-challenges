import { cleanup, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TOTAL_PLANNED_CHALLENGES } from '@/challenges/categories';
import { challengeRegistry } from '@/challenges/registry';
import { renderApp } from '@/test/app-harness';

// Derived, never hardcoded: the registry grows with every content batch (Plan 03 has already
// landed its vertical slice; Plan 06 lands the rest), and these assertions must stay true at any
// registry size.
const AUTHORED_TOTAL = challengeRegistry.challenges.length;
const CSS_TRANSITIONS_AUTHORED = challengeRegistry.challenges.filter(
  (challenge) => challenge.categoryId === 'css-transitions',
).length;

describe('DashboardPage', () => {
  it('shows overall completion, category rings, and an empty-state CTA', async () => {
    renderApp({ path: '/' });
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeTruthy();
    expect(
      screen.getByText(`0 of ${AUTHORED_TOTAL} authored solved · ${TOTAL_PLANNED_CHALLENGES} planned.`),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: `Transitions & state changes: 0 of ${CSS_TRANSITIONS_AUTHORED} solved` }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /browse the catalog/i })).toBeTruthy();
  });

  it('offers continue-where-you-left-off and a weakest-category suggestion once attempts exist', async () => {
    const { repository } = renderApp({ path: '/' });
    await screen.findByRole('heading', { name: /dashboard/i });
    await repository.upsertProgress({
      id: 'css-transitions/hover-lift',
      challengeId: 'css-transitions/hover-lift',
      status: 'attempted',
      solveQuality: null,
      attempts: 1,
      hintsRevealed: 0,
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // Fresh mount (fresh QueryClient) to pick up the new record; unmount the first app so role
    // queries stay unambiguous (the global afterEach cleanup only runs BETWEEN tests):
    cleanup();
    renderApp({ path: '/', repository });
    expect(await screen.findByRole('link', { name: /continue: hover lift/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /practice transitions & state changes/i })).toBeTruthy();
  });
});
