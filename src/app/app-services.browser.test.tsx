import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useProgressRepository } from '@/app/repository-provider';
import { useThemeEffect } from '@/app/theme';
import { useSettingsStore } from '@/stores';
import { renderWithProviders } from '@/test/app-harness';

function RepoProbe(): React.JSX.Element {
  const repo = useProgressRepository();
  return <p>{typeof repo.sync === 'function' ? 'repository-ready' : 'repository-missing'}</p>;
}

function ThemeProbe(): React.JSX.Element {
  useThemeEffect();
  return <p>theme-probe</p>;
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
});
