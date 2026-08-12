import { describe, expect, it } from 'vitest';

import { reconcileByUpdatedAt, stableStringify, unionById, type Timestamped } from '@/data/reconcile';

interface Rec extends Timestamped {
  body: string;
}

const NO_DIRTY: ReadonlySet<string> = new Set();

function rec(id: string, updatedAt: string, body = 'x'): Rec {
  return { id, updatedAt, body };
}

const T_OLD = '2026-08-01T10:00:00.000Z';
const T_NEW = '2026-08-02T10:00:00.000Z';

describe('stableStringify', () => {
  it('is insensitive to key order, recursively', () => {
    expect(stableStringify({ b: 1, a: { d: [1, 2], c: 'x' } })).toBe(
      stableStringify({ a: { c: 'x', d: [1, 2] }, b: 1 }),
    );
  });

  it('distinguishes different values', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});

describe('reconcileByUpdatedAt', () => {
  it('pushes local-only records and pulls remote-only records', () => {
    const plan = reconcileByUpdatedAt([rec('a', T_OLD)], [rec('b', T_OLD)], NO_DIRTY);
    expect(plan.toPush).toEqual([rec('a', T_OLD)]);
    expect(plan.toWriteLocal).toEqual([rec('b', T_OLD)]);
    expect(plan.merged.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('remote strictly newer wins — even when the local machine clock is behind', () => {
    const local = rec('a', T_OLD, 'local');
    const remote = rec('a', T_NEW, 'remote');
    const plan = reconcileByUpdatedAt([local], [remote], NO_DIRTY);
    expect(plan.merged).toEqual([remote]);
    expect(plan.toWriteLocal).toEqual([remote]);
    expect(plan.toPush).toEqual([]);
  });

  it('local strictly newer wins — even when the remote clock ran ahead in the past', () => {
    const local = rec('a', T_NEW, 'local');
    const remote = rec('a', T_OLD, 'remote');
    const plan = reconcileByUpdatedAt([local], [remote], NO_DIRTY);
    expect(plan.merged).toEqual([local]);
    expect(plan.toPush).toEqual([local]);
    expect(plan.toWriteLocal).toEqual([]);
  });

  it('same timestamp, identical content: no traffic at all', () => {
    const plan = reconcileByUpdatedAt([rec('a', T_OLD)], [rec('a', T_OLD)], NO_DIRTY);
    expect(plan.toPush).toEqual([]);
    expect(plan.toWriteLocal).toEqual([]);
    expect(plan.merged).toEqual([rec('a', T_OLD)]);
  });

  it('same timestamp, different content: local wins and pushes (deterministic tie-break)', () => {
    const local = rec('a', T_OLD, 'local');
    const remote = rec('a', T_OLD, 'remote');
    const plan = reconcileByUpdatedAt([local], [remote], NO_DIRTY);
    expect(plan.merged).toEqual([local]);
    expect(plan.toPush).toEqual([local]);
    expect(plan.toWriteLocal).toEqual([]);
  });

  it('a dirty local record beats a remote with a NEWER timestamp', () => {
    const local = rec('a', T_OLD, 'unacknowledged local write');
    const remote = rec('a', T_NEW, 'remote');
    const plan = reconcileByUpdatedAt([local], [remote], new Set(['a']));
    expect(plan.merged).toEqual([local]);
    expect(plan.toPush).toEqual([local]);
    expect(plan.toWriteLocal).toEqual([]);
  });

  it('an unparseable timestamp on either side falls to the local-wins tie branch', () => {
    const localGarbage = rec('a', 'not-a-date', 'local');
    const remoteFine = rec('a', T_NEW, 'remote');
    expect(reconcileByUpdatedAt([localGarbage], [remoteFine], NO_DIRTY).merged).toEqual([localGarbage]);
    const localFine = rec('b', T_OLD, 'local');
    const remoteGarbage = rec('b', 'not-a-date', 'remote');
    expect(reconcileByUpdatedAt([localFine], [remoteGarbage], NO_DIRTY).merged).toEqual([localFine]);
  });

  it('merged output is sorted by id regardless of input order', () => {
    const plan = reconcileByUpdatedAt([rec('z', T_OLD), rec('a', T_OLD)], [rec('m', T_OLD)], NO_DIRTY);
    expect(plan.merged.map((entry) => entry.id)).toEqual(['a', 'm', 'z']);
  });
});

describe('unionById', () => {
  interface Item {
    id: string;
    label: string;
  }

  it('unions by id, pushing local-only and pulling remote-only', () => {
    const local: Item[] = [
      { id: 'a', label: 'local-a' },
      { id: 'b', label: 'local-b' },
    ];
    const remote: Item[] = [
      { id: 'b', label: 'remote-b' },
      { id: 'c', label: 'remote-c' },
    ];
    const plan = unionById(local, remote);
    expect(plan.toPush).toEqual([{ id: 'a', label: 'local-a' }]);
    expect(plan.toWriteLocal).toEqual([{ id: 'c', label: 'remote-c' }]);
    expect(plan.merged.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(plan.merged.find((item) => item.id === 'b')?.label).toBe('local-b');
  });
});
