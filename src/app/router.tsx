import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { RootLayout } from '@/app/layout/RootLayout';
import { CatalogPage } from '@/app/pages/CatalogPage';
import { DashboardPage } from '@/app/pages/DashboardPage';
import { ProgressPage } from '@/app/pages/ProgressPage';
import { SettingsPage } from '@/app/pages/SettingsPage';
import { WorkspacePage } from '@/app/pages/WorkspacePage';

const rootRoute = createRootRoute({ component: RootLayout });

const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage });
const catalogRoute = createRoute({ getParentRoute: () => rootRoute, path: '/challenges', component: CatalogPage });
const progressRoute = createRoute({ getParentRoute: () => rootRoute, path: '/progress', component: ProgressPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage });

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/challenges/$categoryId/$slug',
  component: function WorkspaceRouteComponent() {
    const { categoryId, slug } = workspaceRoute.useParams();
    return <WorkspacePage categoryId={categoryId} slug={slug} />;
  },
});

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  catalogRoute,
  workspaceRoute,
  progressRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
