import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { routeTree } from '@/app/router';

afterEach(() => {
  cleanup();
});

function renderAt(path: string): void {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(<RouterProvider router={router} />);
}

describe('route tree', () => {
  it('renders the dashboard at /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeTruthy();
  });

  it('renders the catalog at /challenges', async () => {
    renderAt('/challenges');
    expect(await screen.findByRole('heading', { name: /challenges/i })).toBeTruthy();
  });

  it('renders the workspace with route params', async () => {
    renderAt('/challenges/css-transitions/hover-lift');
    expect(await screen.findByText('css-transitions/hover-lift')).toBeTruthy();
  });
});
