import { describe, expect, it } from 'vitest';

import { MemoryStorage, STORAGE_KEYS } from '@/data/storage';
import { createWorkspaceStore, DEFAULT_PANE_SIZES, WORKSPACE_STORE_VERSION } from '@/stores/workspace-store';

const CHALLENGE_ID = 'css-transitions/hover-lift';

describe('createWorkspaceStore', () => {
  it('starts empty with defaults', () => {
    const store = createWorkspaceStore(new MemoryStorage());
    const state = store.getState();
    expect(state.byChallenge).toEqual({});
    expect(state.lastRunResult).toBeNull();
    expect(state.paneSizes).toEqual(DEFAULT_PANE_SIZES);
    expect(state.catalogViewMode).toBe('grid');
  });

  it('updates per-challenge state immutably through its actions', () => {
    const store = createWorkspaceStore(new MemoryStorage());
    store.getState().setDraftFile(CHALLENGE_ID, 'styles.css', '.card { }');
    store.getState().setActiveFile(CHALLENGE_ID, 'styles.css');
    store.getState().revealNextHint(CHALLENGE_ID);
    store.getState().setSpoilerShown(CHALLENGE_ID, true);
    const challenge = store.getState().byChallenge[CHALLENGE_ID];
    expect(challenge).toEqual({
      draftFiles: { 'styles.css': '.card { }' },
      activeFilePath: 'styles.css',
      revealedHintCount: 1,
      spoilerShown: true,
    });
  });

  it('resetChallengeState drops exactly that challenge', () => {
    const store = createWorkspaceStore(new MemoryStorage());
    store.getState().setDraftFile(CHALLENGE_ID, 'styles.css', 'a');
    store.getState().setDraftFile('waapi/bounce-in', 'index.ts', 'b');
    store.getState().resetChallengeState(CHALLENGE_ID);
    expect(store.getState().byChallenge[CHALLENGE_ID]).toBeUndefined();
    expect(store.getState().byChallenge['waapi/bounce-in']).toBeDefined();
  });

  it('persists drafts and preferences but never lastRunResult', () => {
    const storage = new MemoryStorage();
    const store = createWorkspaceStore(storage);
    store.getState().setDraftFile(CHALLENGE_ID, 'styles.css', '.card { }');
    store.getState().setCatalogViewMode('list');
    store.getState().setPaneSizes([30, 40, 30]);
    store
      .getState()
      .setLastRunResult({ passed: false, failures: [], durationMs: 10, completedAt: '2026-08-01T10:00:00.000Z' });
    const raw = storage.getItem(STORAGE_KEYS.workspace);
    expect(raw).not.toBeNull();
    const persisted: unknown = JSON.parse(raw ?? 'null');
    expect(JSON.stringify(persisted)).not.toContain('lastRunResult');
    // A fresh store over the same storage rehydrates the persisted slice only:
    const rehydrated = createWorkspaceStore(storage).getState();
    expect(rehydrated.byChallenge[CHALLENGE_ID]?.draftFiles).toEqual({ 'styles.css': '.card { }' });
    expect(rehydrated.catalogViewMode).toBe('list');
    expect(rehydrated.paneSizes).toEqual([30, 40, 30]);
    expect(rehydrated.lastRunResult).toBeNull();
  });

  it('falls back to defaults when an old version fails validation in migrate', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({ state: { byChallenge: 'garbage' }, version: WORKSPACE_STORE_VERSION - 1 }),
    );
    const state = createWorkspaceStore(storage).getState();
    expect(state.byChallenge).toEqual({});
    expect(state.paneSizes).toEqual(DEFAULT_PANE_SIZES);
  });

  it('rejects hostile persisted data even at the CURRENT version (validated on every hydrate)', () => {
    // migrate never runs when versions match — this is the merge guard's test.
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({ state: { byChallenge: 'garbage', paneSizes: 'huge' }, version: WORKSPACE_STORE_VERSION }),
    );
    const state = createWorkspaceStore(storage).getState();
    expect(state.byChallenge).toEqual({});
    expect(state.paneSizes).toEqual(DEFAULT_PANE_SIZES);
    expect(typeof state.setDraftFile).toBe('function');
  });
});
