import { createBrowserStorage } from '@/data/storage';
import { createSettingsStore } from '@/stores/settings-store';
import { createWorkspaceStore } from '@/stores/workspace-store';

// The browser bindings. Import ONLY from code that runs in a browser: this module touches
// window.localStorage at import time. Node unit tests use the factories with MemoryStorage.
const browserStorage = createBrowserStorage();

export const useWorkspaceStore = createWorkspaceStore(browserStorage);
export const useSettingsStore = createSettingsStore(browserStorage);
