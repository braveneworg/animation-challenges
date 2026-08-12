import { describe, expect, it } from 'vitest';

import { SETTINGS_DEFAULTS } from '@/data/records';
import { MemoryStorage, STORAGE_KEYS } from '@/data/storage';
import { createSettingsStore, SETTINGS_STORE_VERSION } from '@/stores/settings-store';

describe('createSettingsStore', () => {
  it('starts at the defaults', () => {
    expect(createSettingsStore(new MemoryStorage()).getState().settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('updateSettings merges a partial patch and persists it', () => {
    const storage = new MemoryStorage();
    const store = createSettingsStore(storage);
    store.getState().updateSettings({ theme: 'dark', graderTimeoutMs: 8000 });
    expect(store.getState().settings).toEqual({ ...SETTINGS_DEFAULTS, theme: 'dark', graderTimeoutMs: 8000 });
    const rehydrated = createSettingsStore(storage).getState().settings;
    expect(rehydrated.theme).toBe('dark');
    expect(rehydrated.graderTimeoutMs).toBe(8000);
  });

  it('resetSettings restores the defaults', () => {
    const store = createSettingsStore(new MemoryStorage());
    store.getState().updateSettings({ apiBaseUrl: '' });
    store.getState().resetSettings();
    expect(store.getState().settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('migrate keeps known-good fields from an older version and defaults the rest', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ state: { settings: { theme: 'dark' } }, version: SETTINGS_STORE_VERSION - 1 }),
    );
    const settings = createSettingsStore(storage).getState().settings;
    expect(settings.theme).toBe('dark');
    expect(settings.graderTimeoutMs).toBe(SETTINGS_DEFAULTS.graderTimeoutMs);
  });

  it('rejects hostile persisted data even at the CURRENT version (validated on every hydrate)', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        state: { settings: { theme: 'hacked', graderTimeoutMs: 'NaN' } },
        version: SETTINGS_STORE_VERSION,
      }),
    );
    expect(createSettingsStore(storage).getState().settings).toEqual(SETTINGS_DEFAULTS);
  });
});
