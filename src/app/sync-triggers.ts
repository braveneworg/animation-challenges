import type { SyncResult } from '@/data/mirrored-repository';

export interface SyncTriggerRepository {
  sync(): Promise<SyncResult>;
  flush(): Promise<void>;
}

export interface SyncTriggerEvents {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

// `onSynced` and `isHidden` are declared as function-typed properties rather than method shorthand:
// interface method syntax carries an implicit polymorphic `this`, which is exactly what
// `typescript/unbound-method` flags when `startSyncTriggers` destructures `{ onSynced, isHidden }`
// below. Neither implementation reads `this`, so the property form is both accurate and lint-clean
// (same pattern as `LoopGuard` in src/sandbox/loop-guard-runtime.ts).
export interface SyncTriggerOptions {
  repository: SyncTriggerRepository;
  onSynced: (result: SyncResult) => void;
  windowEvents: SyncTriggerEvents;
  documentEvents: SyncTriggerEvents;
  isHidden: () => boolean;
}

/**
 * Wires Plan 04's sync/flush primitives to their triggers (spec §3.4/§7.2): a boot reconcile,
 * a re-sync on reconnect, and a flush of in-flight mirror writes on pagehide / tab-hidden.
 * Pure over injected event targets so it is fully unit-testable; the React binding lives in
 * RepositoryProvider. `sync()` never throws per the Plan 04 contract; the catch is a backstop
 * so a broken repository can never leave the in-flight flag stuck.
 */
export function startSyncTriggers(options: SyncTriggerOptions): () => void {
  const { repository, onSynced, windowEvents, documentEvents, isHidden } = options;
  let syncing = false;
  let detached = false;

  const runSync = (): void => {
    if (syncing) return;
    syncing = true;
    void repository
      .sync()
      .then((result) => {
        if (!detached) onSynced(result);
        return undefined;
      })
      .catch(() => undefined)
      .finally(() => {
        syncing = false;
      });
  };

  const runFlush = (): void => {
    void repository.flush().catch(() => undefined);
  };

  const onOnline = (): void => runSync();
  const onPageHide = (): void => runFlush();
  const onVisibilityChange = (): void => {
    if (isHidden()) runFlush();
  };

  windowEvents.addEventListener('online', onOnline);
  windowEvents.addEventListener('pagehide', onPageHide);
  documentEvents.addEventListener('visibilitychange', onVisibilityChange);
  runSync();

  return (): void => {
    detached = true;
    windowEvents.removeEventListener('online', onOnline);
    windowEvents.removeEventListener('pagehide', onPageHide);
    documentEvents.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
