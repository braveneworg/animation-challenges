import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSettingsStore, useWorkspaceStore } from '@/stores';
import { renderApp } from '@/test/app-harness';

describe('SettingsPage', () => {
  it('saves valid settings into the store', async () => {
    renderApp({ path: '/settings' });
    const timeout = await screen.findByLabelText(/grader timeout/i);
    fireEvent.change(timeout, { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText(/theme/i), { target: { value: 'dark' } });
    fireEvent.click(screen.getByLabelText(/reduced-motion preview/i));
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    await waitFor(() => {
      const { settings } = useSettingsStore.getState();
      expect(settings.graderTimeoutMs).toBe(8000);
      expect(settings.theme).toBe('dark');
      expect(settings.reducedMotionPreview).toBe(true);
    });
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });

  it('rejects an out-of-range grader timeout with a visible error and no store write', async () => {
    renderApp({ path: '/settings' });
    const timeout = await screen.findByLabelText(/grader timeout/i);
    fireEvent.change(timeout, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(useSettingsStore.getState().settings.graderTimeoutMs).not.toBe(100);
  });

  it('reset progress wipes progress data but keeps settings and drafts (clearProgressData, never clearNamespace)', async () => {
    renderApp({ path: '/settings' });
    await screen.findByRole('heading', { name: /settings/i });
    // Seed all three storage families:
    window.localStorage.setItem('animation-challenges:progress', JSON.stringify({ schemaVersion: 1, data: [] }));
    useSettingsStore.getState().updateSettings({ theme: 'dark' });
    useWorkspaceStore.getState().setDraftFile('css-transitions/hover-lift', 'styles.css', '/* draft */');
    await waitFor(() => {
      expect(window.localStorage.getItem('animation-challenges:settings')).not.toBeNull();
      expect(window.localStorage.getItem('animation-challenges:workspace')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /reset progress/i }));
    fireEvent.click(await screen.findByRole('button', { name: /delete progress/i }));
    await waitFor(() => expect(window.localStorage.getItem('animation-challenges:progress')).toBeNull());
    expect(window.localStorage.getItem('animation-challenges:settings')).not.toBeNull();
    expect(window.localStorage.getItem('animation-challenges:workspace')).not.toBeNull();
  });
});
