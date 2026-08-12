import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '@/data/storage';
import { useSettingsStore, useWorkspaceStore } from '@/stores/index';

function clearStoreKeys(): void {
  window.localStorage.removeItem(STORAGE_KEYS.workspace);
  window.localStorage.removeItem(STORAGE_KEYS.settings);
}

beforeEach(clearStoreKeys);
afterEach(clearStoreKeys);

describe('browser-bound stores', () => {
  it('workspace writes land in window.localStorage under the contract key', () => {
    useWorkspaceStore.getState().setCatalogViewMode('list');
    const raw = window.localStorage.getItem(STORAGE_KEYS.workspace);
    expect(raw).not.toBeNull();
    expect(raw ?? '').toContain('"list"');
  });

  it('settings writes land in window.localStorage under the contract key', () => {
    useSettingsStore.getState().updateSettings({ theme: 'dark' });
    const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
    expect(raw).not.toBeNull();
    expect(raw ?? '').toContain('"dark"');
  });
});
