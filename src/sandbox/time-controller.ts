import { forEachStep } from '@/sandbox/sequence';

/** One virtual frame. Exact division — stepped time accumulates no rounding drift. */
export const FRAME_MS = 1000 / 60;

/** Wall-clock ceiling for `settle()` (spec §6.4): end-state waits never hang a grade. */
export const DEFAULT_SETTLE_TIMEOUT_MS = 3000;

interface ScheduledFrame {
  handle: number;
  callback: FrameRequestCallback;
}

/** Pure virtual rAF queue + clock. Fully node-testable; the browser bindings live in `installTimeController`. */
export class VirtualClock {
  #now = 0;
  #nextHandle = 1;
  #queue: ScheduledFrame[] = [];

  now(): number {
    return this.#now;
  }

  advance(ms: number): void {
    this.#now += ms;
  }

  request(callback: FrameRequestCallback): number {
    const handle = this.#nextHandle;
    this.#nextHandle += 1;
    this.#queue.push({ handle, callback });
    return handle;
  }

  cancel(handle: number): void {
    this.#queue = this.#queue.filter((frame) => frame.handle !== handle);
  }

  pendingCount(): number {
    return this.#queue.length;
  }

  /** Runs everything queued *before* this flush with the current time; re-queues land on the next flush. */
  flush(): void {
    const frames = this.#queue;
    this.#queue = [];
    for (const frame of frames) frame.callback(this.#now);
  }
}

export interface TimeController {
  readonly frameMs: number;
  now(): number;
  stepFrames(n: number): Promise<void>;
  seek(ms: number): Promise<void>;
  settle(options?: { timeoutMs?: number | undefined }): Promise<void>;
}

export interface InstalledTimeController {
  controller: TimeController;
  /** Awaits one NATIVE rAF tick — the harness and DSL need real frames even while rAF is patched. */
  nativeNextFrame: () => Promise<void>;
  uninstall: () => void;
}

/**
 * Installs the three deterministic-time mechanisms of spec §6.4 on `win`.
 *
 * - `seek(ms)`: pauses every `document.getAnimations()` entry at `ms` and waits for computed styles
 *   to settle. Covers CSS transitions, keyframes, WAAPI, and motion's WAAPI-backed paths.
 *   Animations stay paused afterwards; `settle()` resumes them.
 * - `stepFrames(n)`: virtual-clock rAF. The FIRST call after install flushes one zero-advance
 *   baseline frame, so a loop that baselines in its first callback — or via `performance.now()` at
 *   module evaluation (both read 0) — observes exactly n × frameMs of elapsed time. Graders assert
 *   against n frames of motion, never n − 1. A loop started mid-grade baselines on the next
 *   advancing tick and sees n − 1 within that call; start loops at mount.
 * - `settle(options)`: resumes scrubbed animations, then awaits every finite animation's
 *   `finished` behind a wall-clock timeout; infinite animations are skipped.
 *
 * In `'virtual'` mode, `requestAnimationFrame`/`cancelAnimationFrame`, `performance.now`, and
 * `Date.now` are patched (spec §6.4). Timers (`setTimeout`/`setInterval`) are deliberately NOT
 * patched. In `'real'` mode (the preview frame), nothing is patched and `stepFrames` throws.
 */
export function installTimeController(
  win: Window & typeof globalThis,
  mode: 'virtual' | 'real',
): InstalledTimeController {
  const nativeRaf = win.requestAnimationFrame.bind(win);
  const nativeCancelRaf = win.cancelAnimationFrame.bind(win);
  const nativeSetTimeout = win.setTimeout.bind(win);
  const nativePerformanceNow = win.performance.now.bind(win.performance);
  const nativeDateNow = win.Date.now.bind(win.Date);
  const epochBase = nativeDateNow();

  const nativeNextFrame = (): Promise<void> =>
    new Promise((resolve) => {
      nativeRaf(() => {
        resolve();
      });
    });
  const macrotask = (): Promise<void> =>
    new Promise((resolve) => {
      nativeSetTimeout(resolve, 0);
    });

  const clock = new VirtualClock();
  const scrubbed = new Set<Animation>();
  let baselineFlushed = false;

  if (mode === 'virtual') {
    win.requestAnimationFrame = (callback: FrameRequestCallback): number => clock.request(callback);
    win.cancelAnimationFrame = (handle: number): void => {
      clock.cancel(handle);
    };
    Object.defineProperty(win.performance, 'now', { configurable: true, value: (): number => clock.now() });
    win.Date.now = (): number => epochBase + clock.now();
  }

  const controller: TimeController = {
    frameMs: FRAME_MS,

    now(): number {
      return mode === 'virtual' ? clock.now() : nativePerformanceNow();
    },

    async stepFrames(n: number): Promise<void> {
      if (mode !== 'virtual') throw new Error("stepFrames requires the virtual clock (environment.clock: 'virtual')");
      if (!baselineFlushed) {
        baselineFlushed = true;
        clock.flush();
        await macrotask();
      }
      // One native macrotask per tick lets promise continuations scheduled by callbacks run and
      // re-queue their next frame before we advance again.
      await forEachStep(n, async () => {
        clock.advance(FRAME_MS);
        clock.flush();
        await macrotask();
      });
    },

    async seek(ms: number): Promise<void> {
      const animations = win.document.getAnimations();
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = ms;
        scrubbed.add(animation);
      }
      await Promise.all(
        animations.map((animation) =>
          animation.ready.then(
            () => undefined,
            () => undefined,
          ),
        ),
      );
      await nativeNextFrame();
    },

    async settle(options?: { timeoutMs?: number | undefined }): Promise<void> {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
      for (const animation of scrubbed) animation.play();
      scrubbed.clear();
      const finite = win.document.getAnimations().filter((animation) => {
        const end = animation.effect?.getComputedTiming().endTime;
        return typeof end === 'number' && Number.isFinite(end);
      });
      await Promise.race([
        Promise.allSettled(finite.map((animation) => animation.finished)),
        new Promise((resolve) => {
          nativeSetTimeout(resolve, timeoutMs);
        }),
      ]);
      await nativeNextFrame();
    },
  };

  const uninstall = (): void => {
    if (mode !== 'virtual') return;
    win.requestAnimationFrame = nativeRaf;
    win.cancelAnimationFrame = nativeCancelRaf;
    Reflect.deleteProperty(win.performance, 'now');
    win.Date.now = nativeDateNow;
  };

  return { controller, nativeNextFrame, uninstall };
}
