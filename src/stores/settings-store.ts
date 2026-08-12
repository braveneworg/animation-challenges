import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SETTINGS_DEFAULTS, settingsRecordSchema, type SettingsRecord } from '@/data/records';
import { STORAGE_KEYS, type KeyValueStorage } from '@/data/storage';

export interface SettingsState {
  settings: SettingsRecord;
  updateSettings: (patch: Partial<SettingsRecord>) => void;
  resetSettings: () => void;
}

interface SettingsPersistedState {
  settings: SettingsRecord;
}

export const SETTINGS_STORE_VERSION = 1;

const persistedSchema = z.object({ settings: settingsRecordSchema.partial() });

type PersistedSettingsPatch = z.infer<typeof persistedSchema>['settings'];

// zod's `.partial()` types each field as `T | undefined` (not merely optional) so it stays
// exactOptionalPropertyTypes-safe on its own — but that means a plain object spread of the
// patch over SETTINGS_DEFAULTS would widen every field back to `T | undefined`. Resolving
// field-by-field with `??` keeps the result a fully-defined SettingsRecord.
function applyKnownFields(patch: PersistedSettingsPatch): SettingsRecord {
  return {
    theme: patch.theme ?? SETTINGS_DEFAULTS.theme,
    reducedMotionPreview: patch.reducedMotionPreview ?? SETTINGS_DEFAULTS.reducedMotionPreview,
    graderTimeoutMs: patch.graderTimeoutMs ?? SETTINGS_DEFAULTS.graderTimeoutMs,
    apiBaseUrl: patch.apiBaseUrl ?? SETTINGS_DEFAULTS.apiBaseUrl,
  };
}

export function createSettingsStore(storage: KeyValueStorage) {
  return create<SettingsState>()(
    persist<SettingsState, [], [], SettingsPersistedState>(
      (set) => ({
        settings: SETTINGS_DEFAULTS,
        updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
        resetSettings: () => set({ settings: SETTINGS_DEFAULTS }),
      }),
      {
        name: STORAGE_KEYS.settings,
        version: SETTINGS_STORE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ settings: state.settings }),
        migrate: (persistedState) => {
          const parsed = persistedSchema.safeParse(persistedState);
          return { settings: applyKnownFields(parsed.success ? parsed.data.settings : {}) };
        },
        // Same-version hostile data never reaches state: merge validates on every hydrate.
        merge: (persistedState, currentState) => {
          const parsed = persistedSchema.safeParse(persistedState);
          return { ...currentState, settings: applyKnownFields(parsed.success ? parsed.data.settings : {}) };
        },
      },
    ),
  );
}
