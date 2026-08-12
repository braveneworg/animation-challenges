import { describe, expect, it } from 'vitest';

import {
  attemptsKey,
  clearNamespace,
  clearProgressData,
  MemoryStorage,
  noteKey,
  STORAGE_KEYS,
  STORAGE_NAMESPACE,
} from '@/data/storage';

describe('storage keys', () => {
  it('are all under the animation-challenges namespace', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith(`${STORAGE_NAMESPACE}:`)).toBe(true);
    }
    expect(attemptsKey('css-transitions/hover-lift')).toBe('animation-challenges:attempts:css-transitions/hover-lift');
    expect(noteKey('css-transitions/hover-lift')).toBe('animation-challenges:notes:css-transitions/hover-lift');
  });

  it('pin the exact contract strings', () => {
    expect(STORAGE_KEYS).toEqual({
      progress: 'animation-challenges:progress',
      profile: 'animation-challenges:profile',
      dirty: 'animation-challenges:dirty',
      settings: 'animation-challenges:settings',
      workspace: 'animation-challenges:workspace',
    });
  });
});

describe('MemoryStorage', () => {
  it('gets, sets, removes, and lists keys', () => {
    const storage = new MemoryStorage();
    expect(storage.getItem('a')).toBeNull();
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    expect(storage.getItem('a')).toBe('1');
    expect([...storage.keys()].sort()).toEqual(['a', 'b']);
    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
  });
});

describe('clearNamespace', () => {
  it('removes only namespaced keys', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.progress, 'x');
    storage.setItem(attemptsKey('a/b'), 'y');
    storage.setItem('someone-elses-key', 'keep');
    clearNamespace(storage);
    expect(storage.getItem(STORAGE_KEYS.progress)).toBeNull();
    expect(storage.getItem(attemptsKey('a/b'))).toBeNull();
    expect(storage.getItem('someone-elses-key')).toBe('keep');
  });
});

describe('clearProgressData', () => {
  it('removes progress, attempts, notes, profile, and dirty — and NOTHING else', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.progress, 'x');
    storage.setItem(attemptsKey('a/b'), 'y');
    storage.setItem(noteKey('a/b'), 'z');
    storage.setItem(STORAGE_KEYS.profile, 'p');
    storage.setItem(STORAGE_KEYS.dirty, 'd');
    storage.setItem(STORAGE_KEYS.settings, 'my-settings');
    storage.setItem(STORAGE_KEYS.workspace, 'my-drafts');
    storage.setItem('someone-elses-key', 'keep');
    clearProgressData(storage);
    expect(storage.getItem(STORAGE_KEYS.progress)).toBeNull();
    expect(storage.getItem(attemptsKey('a/b'))).toBeNull();
    expect(storage.getItem(noteKey('a/b'))).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.profile)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.dirty)).toBeNull();
    // Resetting progress must not un-configure the app or destroy drafts (spec §5.1):
    expect(storage.getItem(STORAGE_KEYS.settings)).toBe('my-settings');
    expect(storage.getItem(STORAGE_KEYS.workspace)).toBe('my-drafts');
    expect(storage.getItem('someone-elses-key')).toBe('keep');
  });
});
