import { afterEach, describe, expect, it } from 'vitest';

import { clearNamespace, createBrowserStorage, STORAGE_NAMESPACE } from '@/data/storage';

const TEST_KEY = `${STORAGE_NAMESPACE}:browser-test`;

afterEach(() => {
  window.localStorage.removeItem(TEST_KEY);
});

describe('createBrowserStorage', () => {
  it('reads and writes through window.localStorage', () => {
    const storage = createBrowserStorage();
    storage.setItem(TEST_KEY, 'value');
    expect(window.localStorage.getItem(TEST_KEY)).toBe('value');
    expect(storage.getItem(TEST_KEY)).toBe('value');
    expect(storage.keys()).toContain(TEST_KEY);
    storage.removeItem(TEST_KEY);
    expect(window.localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('clearNamespace removes namespaced keys from real localStorage', () => {
    const storage = createBrowserStorage();
    storage.setItem(TEST_KEY, 'value');
    clearNamespace(storage);
    expect(window.localStorage.getItem(TEST_KEY)).toBeNull();
  });
});
