import { DEFAULT_PANE_SIZES, type PaneSizes } from '@/stores/workspace-store';

export const MIN_PANE_PERCENT = 15;
export const PANE_KEYBOARD_STEP = 2;

/** Normalizes persisted sizes (hostile input: localStorage) to a 100% total with a per-pane floor. */
export function clampPaneSizes(sizes: PaneSizes): PaneSizes {
  const [rawA, rawB, rawC] = sizes;
  if (
    !Number.isFinite(rawA) ||
    !Number.isFinite(rawB) ||
    !Number.isFinite(rawC) ||
    rawA <= 0 ||
    rawB <= 0 ||
    rawC <= 0
  ) {
    return DEFAULT_PANE_SIZES;
  }
  const totalRaw = rawA + rawB + rawC;
  let a = (rawA / totalRaw) * 100;
  let b = (rawB / totalRaw) * 100;
  let c = (rawC / totalRaw) * 100;
  // Raise any pane below the floor, taking the difference from the largest other pane. Two passes
  // suffice for three panes whose floors sum to 45%.
  for (let pass = 0; pass < 2; pass += 1) {
    if (a < MIN_PANE_PERCENT) {
      const deficit = MIN_PANE_PERCENT - a;
      a = MIN_PANE_PERCENT;
      if (b >= c) b -= deficit;
      else c -= deficit;
    }
    if (b < MIN_PANE_PERCENT) {
      const deficit = MIN_PANE_PERCENT - b;
      b = MIN_PANE_PERCENT;
      if (a >= c) a -= deficit;
      else c -= deficit;
    }
    if (c < MIN_PANE_PERCENT) {
      const deficit = MIN_PANE_PERCENT - c;
      c = MIN_PANE_PERCENT;
      if (a >= b) a -= deficit;
      else b -= deficit;
    }
  }
  return [a, b, c];
}

/** Moves the boundary between pane[separator] and pane[separator + 1], clamping both to the floor. */
export function resizeAt(sizes: PaneSizes, separator: 0 | 1, deltaPercent: number): PaneSizes {
  const [a, b, c] = clampPaneSizes(sizes);
  if (separator === 0) {
    const next = Math.min(Math.max(a + deltaPercent, MIN_PANE_PERCENT), a + b - MIN_PANE_PERCENT);
    return [next, a + b - next, c];
  }
  const next = Math.min(Math.max(b + deltaPercent, MIN_PANE_PERCENT), b + c - MIN_PANE_PERCENT);
  return [a, next, b + c - next];
}
