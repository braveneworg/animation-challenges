import { describe, expect, it } from 'vitest';

import { clampPaneSizes, MIN_PANE_PERCENT, resizeAt } from '@/features/workspace/pane-layout';
import { DEFAULT_PANE_SIZES } from '@/stores/workspace-store';

function total(sizes: readonly [number, number, number]): number {
  return sizes[0] + sizes[1] + sizes[2];
}

describe('clampPaneSizes', () => {
  it('normalizes valid sizes to a 100% total', () => {
    const sizes = clampPaneSizes([56, 88, 56]);
    expect(total(sizes)).toBeCloseTo(100, 5);
    expect(sizes[0]).toBeCloseTo(28, 5);
  });

  it('replaces garbage with the defaults', () => {
    expect(clampPaneSizes([Number.NaN, 40, 30])).toEqual(DEFAULT_PANE_SIZES);
    expect(clampPaneSizes([-5, 40, 30])).toEqual(DEFAULT_PANE_SIZES);
  });

  it('raises panes below the minimum', () => {
    const sizes = clampPaneSizes([2, 49, 49]);
    expect(sizes[0]).toBeGreaterThanOrEqual(MIN_PANE_PERCENT);
    expect(total(sizes)).toBeCloseTo(100, 5);
  });
});

describe('resizeAt', () => {
  it('moves the first boundary, preserving the pair total', () => {
    const sizes = resizeAt([28, 44, 28], 0, 5);
    expect(sizes[0]).toBeCloseTo(33, 5);
    expect(sizes[1]).toBeCloseTo(39, 5);
    expect(sizes[2]).toBeCloseTo(28, 5);
  });

  it('moves the second boundary and clamps at the minimum', () => {
    const sizes = resizeAt([28, 44, 28], 1, 100);
    expect(sizes[2]).toBeCloseTo(MIN_PANE_PERCENT, 5);
    expect(total(sizes)).toBeCloseTo(100, 5);
  });

  it('never shrinks a pane below the minimum from the left either', () => {
    const sizes = resizeAt([28, 44, 28], 0, -100);
    expect(sizes[0]).toBeCloseTo(MIN_PANE_PERCENT, 5);
  });
});
