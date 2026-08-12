import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RootLayout } from '@/app/layout/RootLayout';
import { RouteErrorScreen } from '@/app/RouteErrorScreen';
import { routeTree } from '@/app/router';

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

  it('renders the not-found screen for an unknown path', async () => {
    renderAt('/definitely-not-a-route');
    expect(await screen.findByRole('heading', { name: /not found/i })).toBeTruthy();
  });

  it('renders the not-found screen for an unknown challenge id', async () => {
    renderAt('/challenges/css-transitions/definitely-not-a-challenge');
    expect(await screen.findByRole('heading', { name: /not found/i })).toBeTruthy();
  });

  it('recovers from a route component error via the default error component', async () => {
    function Boom(): React.JSX.Element {
      throw new Error('boom-for-error-screen');
    }
    const testRoot = createRootRoute({ component: RootLayout });
    const boomRoute = createRoute({ getParentRoute: () => testRoot, path: '/', component: Boom });
    const testRouter = createRouter({
      routeTree: testRoot.addChildren([boomRoute]),
      defaultErrorComponent: RouteErrorScreen,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    render(<RouterProvider router={testRouter} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('boom-for-error-screen')).toBeTruthy();
  });
});
