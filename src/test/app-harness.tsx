import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';

import { RepositoryProvider } from '@/app/repository-provider';
import { routeTree } from '@/app/router';
import { createAppRepository } from '@/data/app-repository';
import type { MirroredProgressRepository } from '@/data/mirrored-repository';
import { SETTINGS_DEFAULTS } from '@/data/records';
import { MemoryStorage } from '@/data/storage';
import { useSettingsStore, useWorkspaceStore } from '@/stores';
import { DEFAULT_PANE_SIZES } from '@/stores/workspace-store';

export interface HarnessContext {
  repository: MirroredProgressRepository;
  queryClient: QueryClient;
}

/** Browser tests share the page's real localStorage and the bound zustand stores — reset both. */
export function resetClientStores(): void {
  window.localStorage.clear();
  useWorkspaceStore.setState({
    byChallenge: {},
    lastRunResult: null,
    paneSizes: DEFAULT_PANE_SIZES,
    catalogViewMode: 'grid',
  });
  // apiBaseUrl '' keeps every test offline: Plan 04's sync() reports 'disabled' and never fetches.
  useSettingsStore.setState({ settings: { ...SETTINGS_DEFAULTS, apiBaseUrl: '' } });
}

interface ProviderOptions {
  repository?: MirroredProgressRepository | undefined;
}

function buildContext(options: ProviderOptions): HarnessContext {
  const repository = options.repository ?? createAppRepository({ apiBaseUrl: '', storage: new MemoryStorage() });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { repository, queryClient };
}

export function renderWithProviders(ui: React.ReactElement, options: ProviderOptions = {}): HarnessContext {
  resetClientStores();
  const context = buildContext(options);
  render(
    <QueryClientProvider client={context.queryClient}>
      <RepositoryProvider repository={context.repository}>{ui}</RepositoryProvider>
    </QueryClientProvider>,
  );
  return context;
}

export function renderApp(options: { path: string } & ProviderOptions): HarnessContext {
  resetClientStores();
  const context = buildContext(options);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [options.path] }) });
  render(
    <QueryClientProvider client={context.queryClient}>
      <RepositoryProvider repository={context.repository}>
        <RouterProvider router={router} />
      </RepositoryProvider>
    </QueryClientProvider>,
  );
  return context;
}
