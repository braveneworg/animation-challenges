import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce } from '@/lib/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once on the trailing edge with the latest arguments', () => {
    const calls: string[] = [];
    const save = debounce((value: string) => calls.push(value), 300);
    save('a');
    save('ab');
    save('abc');
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['abc']);
  });

  it('flush invokes a pending call immediately and only once', () => {
    const calls: string[] = [];
    const save = debounce((value: string) => calls.push(value), 300);
    save('pending');
    save.flush();
    expect(calls).toEqual(['pending']);
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['pending']);
  });

  it('flush without a pending call is a no-op, and cancel drops the pending call', () => {
    const calls: string[] = [];
    const save = debounce((value: string) => calls.push(value), 300);
    save.flush();
    expect(calls).toEqual([]);
    save('dropped');
    save.cancel();
    vi.advanceTimersByTime(300);
    expect(calls).toEqual([]);
  });
});
