import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { RepositoryProvider, useProgressRepository } from '@/app/repository-provider';
import { useThemeEffect } from '@/app/theme';
import type { MirroredProgressRepository } from '@/data/mirrored-repository';
import { useSettingsStore } from '@/stores';
import { renderWithProviders, resetClientStores } from '@/test/app-harness';

function RepoProbe(): React.JSX.Element {
  const repo = useProgressRepository();
  return <p>{typeof repo.sync === 'function' ? 'repository-ready' : 'repository-missing'}</p>;
}

function ThemeProbe(): React.JSX.Element {
  useThemeEffect();
  return <p>theme-probe</p>;
}

interface RepoCaptureProbeProps {
  onRepo: (repo: MirroredProgressRepository) => void;
}

function RepoCaptureProbe({ onRepo }: RepoCaptureProbeProps): React.JSX.Element {
  // useThemeEffect gives the test an observable DOM signal (the `.dark` class) it can wait on to
  // know an unrelated settings change has been fully processed, without asserting on the
  // repository itself (which, correctly, does not change for unrelated settings).
  useThemeEffect();
  const repo = useProgressRepository();
  useEffect(() => {
    onRepo(repo);
  }, [repo, onRepo]);
  return <p>repo-captured</p>;
}

describe('app services', () => {
  it('provides a repository through context', async () => {
    renderWithProviders(<RepoProbe />);
    expect(await screen.findByText('repository-ready')).toBeTruthy();
  });

  it('applies the persisted theme preference to the document root', async () => {
    renderWithProviders(<ThemeProbe />);
    useSettingsStore.getState().updateSettings({ theme: 'dark' });
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    useSettingsStore.getState().updateSettings({ theme: 'light' });
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(false));
  });

  it('rebuilds the repository when apiBaseUrl changes, but keeps the same instance for unrelated settings changes', async () => {
    resetClientStores();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const seen: MirroredProgressRepository[] = [];
    render(
      <QueryClientProvider client={queryClient}>
        <RepositoryProvider>
          <RepoCaptureProbe onRepo={(repo) => seen.push(repo)} />
        </RepositoryProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('repo-captured');
    expect(seen).toHaveLength(1);
    const initial = seen[0];

    // Unrelated settings change: wait on the theme effect's DOM side effect, then confirm no new
    // repository was captured — the sync-trigger effect never re-ran because `repo` stayed the
    // same reference.
    useSettingsStore.getState().updateSettings({ theme: 'dark' });
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(seen).toHaveLength(1);

    // apiBaseUrl change: the provider's useMemo dependency changes, so a new repository is built.
    useSettingsStore.getState().updateSettings({ apiBaseUrl: 'http://127.0.0.1:1' });
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1]).not.toBe(initial);
  });
});
