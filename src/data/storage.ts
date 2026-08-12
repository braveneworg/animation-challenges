export const STORAGE_NAMESPACE = 'animation-challenges';

export const STORAGE_KEYS = {
  progress: `${STORAGE_NAMESPACE}:progress`,
  profile: `${STORAGE_NAMESPACE}:profile`,
  dirty: `${STORAGE_NAMESPACE}:dirty`,
  settings: `${STORAGE_NAMESPACE}:settings`,
  workspace: `${STORAGE_NAMESPACE}:workspace`,
} as const;

export const ATTEMPTS_KEY_PREFIX = `${STORAGE_NAMESPACE}:attempts:`;
export const NOTES_KEY_PREFIX = `${STORAGE_NAMESPACE}:notes:`;

export function attemptsKey(challengeId: string): string {
  return `${ATTEMPTS_KEY_PREFIX}${challengeId}`;
}

export function noteKey(challengeId: string): string {
  return `${NOTES_KEY_PREFIX}${challengeId}`;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): readonly string[];
}

export class MemoryStorage implements KeyValueStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  keys(): readonly string[] {
    return [...this.store.keys()];
  }
}

/** The one browser-coupled binding. Only import from code that runs in a browser. */
export function createBrowserStorage(): KeyValueStorage {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => {
      window.localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      window.localStorage.removeItem(key);
    },
    keys: () => Object.keys(window.localStorage),
  };
}

/**
 * Backs the settings screen's "reset progress" (spec §5.1): removes progress, attempts,
 * notes, profile, and the dirty set — NEVER settings or workspace drafts. Resetting
 * progress must not un-configure the app.
 */
export function clearProgressData(storage: KeyValueStorage): void {
  storage.removeItem(STORAGE_KEYS.progress);
  storage.removeItem(STORAGE_KEYS.profile);
  storage.removeItem(STORAGE_KEYS.dirty);
  for (const key of storage.keys()) {
    if (key.startsWith(ATTEMPTS_KEY_PREFIX) || key.startsWith(NOTES_KEY_PREFIX)) {
      storage.removeItem(key);
    }
  }
}

/** Nuclear option (tests, future full-reset): removes EVERY namespaced key, settings and drafts included. */
export function clearNamespace(storage: KeyValueStorage): void {
  const prefix = `${STORAGE_NAMESPACE}:`;
  for (const key of storage.keys()) {
    if (key.startsWith(prefix)) {
      storage.removeItem(key);
    }
  }
}
