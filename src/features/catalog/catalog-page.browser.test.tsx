import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/app-harness';

describe('CatalogPage', () => {
  it('lists registry challenges with status badges and links to the workspace', async () => {
    renderApp({ path: '/challenges' });
    const link = await screen.findByRole('link', { name: /hover lift/i });
    expect(link.getAttribute('href')).toBe('/challenges/css-transitions/hover-lift');
    expect(screen.getAllByText('Unsolved').length).toBeGreaterThan(0);
  });

  it('applies a filter from the URL on first render', async () => {
    // q=zzz-no-match is content-proof: no present or future challenge title/id/tag will ever match
    // it, so the empty state stays asserted no matter how large the registry grows (Plans 03/06).
    renderApp({ path: '/challenges?q=zzz-no-match' });
    await screen.findByRole('heading', { name: /challenges/i });
    expect(screen.queryByRole('link', { name: /hover lift/i })).toBeNull();
    expect(await screen.findByText(/no challenges match/i)).toBeTruthy();
  });

  it('changing a filter select updates the list and supports clearing', async () => {
    renderApp({ path: '/challenges' });
    await screen.findByRole('link', { name: /hover lift/i });
    // hover-lift is novice (stable challenge data), so filtering to any other difficulty removes
    // it. Assert ITS disappearance, not the global empty state — the registry may well contain
    // expert challenges by now, and will (Plans 03/06).
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'expert' } });
    await waitFor(() => expect(screen.queryByRole('link', { name: /hover lift/i })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(await screen.findByRole('link', { name: /hover lift/i })).toBeTruthy();
  });

  it('shows solved status from the repository join', async () => {
    const { repository, queryClient } = renderApp({ path: '/challenges' });
    await screen.findByRole('link', { name: /hover lift/i });
    await repository.upsertProgress({
      id: 'css-transitions/hover-lift',
      challengeId: 'css-transitions/hover-lift',
      status: 'solved',
      solveQuality: 'clean',
      attempts: 2,
      hintsRevealed: 0,
      updatedAt: new Date().toISOString(),
    });
    // Direct repository writes bypass the mutation helpers, so refresh the query cache by hand:
    await queryClient.invalidateQueries();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'solved' } });
    await waitFor(() => expect(screen.getByText('Solved')).toBeTruthy());
    expect(screen.getByText('Clean solve')).toBeTruthy();
  });

  it('toggles between grid and list view', async () => {
    renderApp({ path: '/challenges' });
    await screen.findByRole('link', { name: /hover lift/i });
    const gridButton = screen.getByRole('button', { name: 'Grid view' });
    const listButton = screen.getByRole('button', { name: 'List view' });
    expect(gridButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(listButton);
    await waitFor(() => expect(listButton.getAttribute('aria-pressed')).toBe('true'));
  });
});
