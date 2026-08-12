import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { startSyncTriggers } from '@/app/sync-triggers';
import { createAppRepository } from '@/data/app-repository';
import type { MirroredProgressRepository } from '@/data/mirrored-repository';
import { invalidateAllData } from '@/data/queries';
import { useSettingsStore } from '@/stores';

const RepositoryContext = createContext<MirroredProgressRepository | null>(null);

interface RepositoryProviderProps {
  children: React.ReactNode;
  /** Test seam: inject a MemoryStorage-backed repository. Production leaves it undefined. */
  repository?: MirroredProgressRepository | undefined;
}

export function RepositoryProvider({ children, repository }: RepositoryProviderProps): React.JSX.Element {
  const apiBaseUrl = useSettingsStore((state) => state.settings.apiBaseUrl);
  const queryClient = useQueryClient();
  // Re-created when apiBaseUrl changes, per the Plan 04 contract ("re-create the repository via
  // createAppRepository when settings.apiBaseUrl changes"). The effect below then re-runs its
  // boot sync against the new remote.
  const repo = useMemo(() => repository ?? createAppRepository({ apiBaseUrl }), [repository, apiBaseUrl]);

  useEffect(() => {
    return startSyncTriggers({
      repository: repo,
      onSynced: (result) => {
        if (result.pulled > 0) void invalidateAllData(queryClient).catch(() => undefined);
      },
      windowEvents: window,
      documentEvents: document,
      isHidden: () => document.visibilityState === 'hidden',
    });
  }, [repo, queryClient]);

  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

export function useProgressRepository(): MirroredProgressRepository {
  const repo = useContext(RepositoryContext);
  if (repo === null) throw new Error('useProgressRepository must be used inside RepositoryProvider');
  return repo;
}
