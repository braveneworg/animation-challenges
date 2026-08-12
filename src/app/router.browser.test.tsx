import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { RepositoryProvider } from '@/app/repository-provider';
import { RouteErrorScreen } from '@/app/RouteErrorScreen';
import { routeTree } from '@/app/router';
import { createAppRepository } from '@/data/app-repository';
import { MemoryStorage } from '@/data/storage';

// The workspace route (Task 10) is a real page now, not a placeholder: it reads the progress
// repository through context, same as the rest of the app (see AppProviders). This helper mirrors
// that composition — QueryClientProvider + RepositoryProvider around the router — so every route
// renders under the same context the real app provides, exactly like src/test/app-harness.tsx's
// renderApp does for the workspace's own tests.
function renderAt(path: string): void {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const repository = createAppRepository({ apiBaseUrl: '', storage: new MemoryStorage() });
  render(
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository}>
        <RouterProvider router={router} />
      </RepositoryProvider>
    </QueryClientProvider>,
  );
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
    // The workspace (Task 10) is the real page now, not the id-echoing placeholder this test was
    // written against — the loader resolving the right challenge from route params shows up as its
    // title in the prompt pane instead.
    expect(await screen.findByRole('heading', { name: 'Hover lift' })).toBeTruthy();
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
