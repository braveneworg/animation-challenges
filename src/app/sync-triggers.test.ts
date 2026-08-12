import { describe, expect, it } from 'vitest';

import { startSyncTriggers, type SyncTriggerEvents, type SyncTriggerOptions } from '@/app/sync-triggers';
import type { SyncResult } from '@/data/mirrored-repository';

function fakeEvents(): SyncTriggerEvents & { fire(type: string): void; count(type: string): number } {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener: (type, listener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    fire: (type) => {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    count: (type) => listeners.get(type)?.size ?? 0,
  };
}

interface Harness {
  windowEvents: ReturnType<typeof fakeEvents>;
  documentEvents: ReturnType<typeof fakeEvents>;
  syncCalls: number;
  flushCalls: number;
  results: SyncResult[];
  resolveSync(result?: Partial<SyncResult>): Promise<void>;
  detach(): void;
  hidden: boolean;
}

function startHarness(): Harness {
  const windowEvents = fakeEvents();
  const documentEvents = fakeEvents();
  const pending: Array<(result: SyncResult) => void> = [];
  const harness: Harness = {
    windowEvents,
    documentEvents,
    syncCalls: 0,
    flushCalls: 0,
    results: [],
    hidden: false,
    resolveSync: async (result = {}) => {
      const resolve = pending.shift();
      if (resolve === undefined) throw new Error('no pending sync to resolve');
      resolve({ status: 'synced', pushed: 0, pulled: 0, errors: [], ...result });
      // One macrotask flushes the whole then/catch/finally chain inside startSyncTriggers —
      // counting microtask ticks would couple the test to the chain's length.
      await new Promise((settle) => setTimeout(settle, 0));
    },
    detach: () => undefined,
  };
  const options: SyncTriggerOptions = {
    repository: {
      sync: () => {
        harness.syncCalls += 1;
        return new Promise<SyncResult>((resolve) => pending.push(resolve));
      },
      flush: () => {
        harness.flushCalls += 1;
        return Promise.resolve();
      },
    },
    onSynced: (result) => harness.results.push(result),
    windowEvents,
    documentEvents,
    isHidden: () => harness.hidden,
  };
  harness.detach = startSyncTriggers(options);
  return harness;
}

describe('startSyncTriggers', () => {
  it('runs a boot sync immediately and reports the result', async () => {
    const harness = startHarness();
    expect(harness.syncCalls).toBe(1);
    await harness.resolveSync({ pulled: 2 });
    expect(harness.results).toHaveLength(1);
    expect(harness.results[0]?.pulled).toBe(2);
  });

  it('syncs again when the window comes back online', async () => {
    const harness = startHarness();
    await harness.resolveSync();
    harness.windowEvents.fire('online');
    expect(harness.syncCalls).toBe(2);
  });

  it('never overlaps syncs: online during an in-flight sync is skipped', async () => {
    const harness = startHarness();
    harness.windowEvents.fire('online'); // boot sync still pending
    expect(harness.syncCalls).toBe(1);
    await harness.resolveSync();
    harness.windowEvents.fire('online');
    expect(harness.syncCalls).toBe(2);
  });

  it('flushes on pagehide', () => {
    const harness = startHarness();
    harness.windowEvents.fire('pagehide');
    expect(harness.flushCalls).toBe(1);
  });

  it('flushes when the document becomes hidden, and not when it becomes visible', () => {
    const harness = startHarness();
    harness.hidden = true;
    harness.documentEvents.fire('visibilitychange');
    expect(harness.flushCalls).toBe(1);
    harness.hidden = false;
    harness.documentEvents.fire('visibilitychange');
    expect(harness.flushCalls).toBe(1);
  });

  it('detaches all listeners', async () => {
    const harness = startHarness();
    await harness.resolveSync();
    harness.detach();
    harness.windowEvents.fire('online');
    harness.windowEvents.fire('pagehide');
    harness.documentEvents.fire('visibilitychange');
    expect(harness.syncCalls).toBe(1);
    expect(harness.flushCalls).toBe(0);
    expect(harness.windowEvents.count('online')).toBe(0);
    expect(harness.windowEvents.count('pagehide')).toBe(0);
    expect(harness.documentEvents.count('visibilitychange')).toBe(0);
  });
});
