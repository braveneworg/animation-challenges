import { describe, expect, test } from 'vitest';

import { FRAME_MS, VirtualClock } from '@/sandbox/time-controller';

describe('VirtualClock', () => {
  test('advance accumulates and now reports it', () => {
    const clock = new VirtualClock();
    expect(clock.now()).toBe(0);
    clock.advance(FRAME_MS);
    clock.advance(FRAME_MS);
    expect(clock.now()).toBeCloseTo(2 * FRAME_MS, 9);
  });

  test('flush runs queued callbacks once, in order, with the current time', () => {
    const clock = new VirtualClock();
    const seen: Array<[string, number]> = [];
    clock.request((t) => seen.push(['a', t]));
    clock.request((t) => seen.push(['b', t]));
    clock.advance(10);
    clock.flush();
    clock.flush();
    expect(seen).toEqual([
      ['a', 10],
      ['b', 10],
    ]);
  });

  test('a callback scheduled during flush runs on the NEXT flush, not the current one', () => {
    const clock = new VirtualClock();
    const seen: number[] = [];
    const loop = (t: number): void => {
      seen.push(t);
      if (seen.length < 3) clock.request(loop);
    };
    clock.request(loop);
    for (let i = 0; i < 3; i += 1) {
      clock.advance(FRAME_MS);
      clock.flush();
    }
    expect(seen.length).toBe(3);
    expect(seen[1]).toBeCloseTo(2 * FRAME_MS, 9);
  });

  test('cancel removes a pending callback', () => {
    const clock = new VirtualClock();
    let ran = false;
    const handle = clock.request(() => {
      ran = true;
    });
    clock.cancel(handle);
    clock.flush();
    expect(ran).toBe(false);
    expect(clock.pendingCount()).toBe(0);
  });
});
