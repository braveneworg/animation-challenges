import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FailureSummary } from '@/data/records';
import { STORAGE_KEYS, type KeyValueStorage } from '@/data/storage';

export interface WorkspaceChallengeState {
  draftFiles: Record<string, string>;
  activeFilePath: string | null;
  revealedHintCount: number;
  spoilerShown: boolean;
}

/** The data-layer shape Plan 05 maps the runner's graded payload into for display. */
export interface RunSummary {
  passed: boolean;
  failures: FailureSummary[];
  durationMs: number;
  completedAt: string;
}

export type CatalogViewMode = 'grid' | 'list';
export type PaneSizes = [number, number, number];

export const DEFAULT_PANE_SIZES: PaneSizes = [28, 44, 28];

export const EMPTY_CHALLENGE_STATE: WorkspaceChallengeState = {
  draftFiles: {},
  activeFilePath: null,
  revealedHintCount: 0,
  spoilerShown: false,
};

export interface WorkspacePersistedState {
  byChallenge: Record<string, WorkspaceChallengeState>;
  paneSizes: PaneSizes;
  catalogViewMode: CatalogViewMode;
}

export interface WorkspaceState extends WorkspacePersistedState {
  /** Ephemeral by design: a stale run result after reload would lie. Never persisted. */
  lastRunResult: RunSummary | null;
  setDraftFile: (challengeId: string, path: string, contents: string) => void;
  setActiveFile: (challengeId: string, path: string | null) => void;
  revealNextHint: (challengeId: string) => void;
  setSpoilerShown: (challengeId: string, shown: boolean) => void;
  resetChallengeState: (challengeId: string) => void;
  setLastRunResult: (result: RunSummary | null) => void;
  setPaneSizes: (sizes: PaneSizes) => void;
  setCatalogViewMode: (mode: CatalogViewMode) => void;
}

export const WORKSPACE_STORE_VERSION = 1;

const persistedSchema = z.object({
  byChallenge: z.record(
    z.string(),
    z.object({
      draftFiles: z.record(z.string(), z.string()),
      activeFilePath: z.string().nullable(),
      revealedHintCount: z.number().int().nonnegative(),
      spoilerShown: z.boolean(),
    }),
  ),
  paneSizes: z.tuple([z.number(), z.number(), z.number()]),
  catalogViewMode: z.enum(['grid', 'list']),
});

function fallbackPersisted(): WorkspacePersistedState {
  return { byChallenge: {}, paneSizes: DEFAULT_PANE_SIZES, catalogViewMode: 'grid' };
}

export function createWorkspaceStore(storage: KeyValueStorage) {
  return create<WorkspaceState>()(
    persist<WorkspaceState, [], [], WorkspacePersistedState>(
      (set) => {
        const patchChallenge = (
          challengeId: string,
          patch: (current: WorkspaceChallengeState) => WorkspaceChallengeState,
        ): void => {
          set((state) => ({
            byChallenge: {
              ...state.byChallenge,
              [challengeId]: patch(state.byChallenge[challengeId] ?? EMPTY_CHALLENGE_STATE),
            },
          }));
        };
        return {
          ...fallbackPersisted(),
          lastRunResult: null,
          setDraftFile: (challengeId, path, contents) =>
            patchChallenge(challengeId, (current) => ({
              ...current,
              draftFiles: { ...current.draftFiles, [path]: contents },
            })),
          setActiveFile: (challengeId, path) =>
            patchChallenge(challengeId, (current) => ({ ...current, activeFilePath: path })),
          revealNextHint: (challengeId) =>
            patchChallenge(challengeId, (current) => ({
              ...current,
              revealedHintCount: current.revealedHintCount + 1,
            })),
          setSpoilerShown: (challengeId, shown) =>
            patchChallenge(challengeId, (current) => ({ ...current, spoilerShown: shown })),
          resetChallengeState: (challengeId) =>
            set((state) => {
              const remaining = { ...state.byChallenge };
              delete remaining[challengeId];
              return { byChallenge: remaining };
            }),
          setLastRunResult: (result) => set({ lastRunResult: result }),
          setPaneSizes: (sizes) => set({ paneSizes: sizes }),
          setCatalogViewMode: (mode) => set({ catalogViewMode: mode }),
        };
      },
      {
        name: STORAGE_KEYS.workspace,
        version: WORKSPACE_STORE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          byChallenge: state.byChallenge,
          paneSizes: state.paneSizes,
          catalogViewMode: state.catalogViewMode,
        }),
        migrate: (persistedState) => {
          const parsed = persistedSchema.safeParse(persistedState);
          return parsed.success ? parsed.data : fallbackPersisted();
        },
        // migrate only runs on a version MISMATCH; merge runs on every hydrate. Validating
        // here is what makes same-version hostile localStorage fall back to defaults.
        merge: (persistedState, currentState) => {
          const parsed = persistedSchema.safeParse(persistedState);
          return { ...currentState, ...(parsed.success ? parsed.data : fallbackPersisted()) };
        },
      },
    ),
  );
}
