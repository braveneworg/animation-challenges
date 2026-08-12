import { createRootRoute, createRoute, createRouter, notFound } from '@tanstack/react-router';

import { RootLayout } from '@/app/layout/RootLayout';
import { NotFoundScreen } from '@/app/NotFoundScreen';
import { RouteErrorScreen } from '@/app/RouteErrorScreen';
import { getChallenge } from '@/challenges/registry';
import { parseCatalogSearch } from '@/features/catalog/catalog-search';
import { CatalogPage } from '@/features/catalog/CatalogPage';
import { DashboardPage } from '@/features/progress/DashboardPage';
import { ProgressPage } from '@/features/progress/ProgressPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFoundScreen });

const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage });
const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/challenges',
  validateSearch: (search: Record<string, unknown>) => parseCatalogSearch(search),
  component: CatalogPage,
});
const progressRoute = createRoute({ getParentRoute: () => rootRoute, path: '/progress', component: ProgressPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage });

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/challenges/$categoryId/$slug',
  loader: ({ params }) => {
    const challenge = getChallenge(`${params.categoryId}/${params.slug}`);
    if (challenge === undefined) throw notFound();
    return { challenge };
  },
  component: function WorkspaceRouteComponent() {
    const { challenge } = workspaceRoute.useLoaderData();
    return <WorkspacePage challenge={challenge} />;
  },
});

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  catalogRoute,
  workspaceRoute,
  progressRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundScreen,
  defaultErrorComponent: RouteErrorScreen,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
