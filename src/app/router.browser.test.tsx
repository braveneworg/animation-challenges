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
import { renderApp } from '@/test/app-harness';

// The workspace route (Task 10) is a real page now, not a placeholder: it reads the progress
// repository through context, same as the rest of the app (see AppProviders). renderApp (the same
// harness the workspace's own tests use) provides that composition — QueryClientProvider +
// RepositoryProvider around the router — AND resets the shared client stores/localStorage between
// tests, which a hand-rolled render here would not.
describe('route tree', () => {
  it('renders the dashboard at /', async () => {
    renderApp({ path: '/' });
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeTruthy();
  });

  it('renders the catalog at /challenges', async () => {
    renderApp({ path: '/challenges' });
    expect(await screen.findByRole('heading', { name: /challenges/i })).toBeTruthy();
  });

  it('renders the workspace with route params', async () => {
    renderApp({ path: '/challenges/css-transitions/hover-lift' });
    // The workspace (Task 10) is the real page now, not the id-echoing placeholder this test was
    // written against — the loader resolving the right challenge from route params shows up as its
    // title in the prompt pane instead.
    expect(await screen.findByRole('heading', { name: 'Hover lift' })).toBeTruthy();
  });

  it('renders the not-found screen for an unknown path', async () => {
    renderApp({ path: '/definitely-not-a-route' });
    expect(await screen.findByRole('heading', { name: /not found/i })).toBeTruthy();
  });

  it('renders the not-found screen for an unknown challenge id', async () => {
    renderApp({ path: '/challenges/css-transitions/definitely-not-a-challenge' });
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
