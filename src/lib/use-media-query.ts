import { useCallback, useSyncExternalStore } from 'react';

/** matchMedia binding via useSyncExternalStore — resubscribes when the query string changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onStoreChange);
      return (): void => media.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
