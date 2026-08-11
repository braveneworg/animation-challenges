import { linkModuleGraph } from '@/runner/module-graph';
import {
  DEFAULT_ENVIRONMENT,
  parseHostMessage,
  PROTOCOL_VERSION,
  type FrameMessage,
  type HostMessage,
  type MountPayload,
  type SandboxEnvironment,
} from '@/runner/protocol';
import { runWithTimeout } from '@/runner/run-with-timeout';
import { safeString } from '@/runner/safe-string';
import { AssertionLog } from '@/sandbox/assertion-log';
import { applyForcedMediaToStyles, enableSimulatedHover, patchMatchMedia } from '@/sandbox/environment';
import { buildGradeContext } from '@/sandbox/grade-context';
import { loadGrader } from '@/sandbox/grader-registry';
import { installLoopGuard } from '@/sandbox/loop-guard-runtime';
import { toExportsRecord } from '@/sandbox/module-exports';
import { mountReactComponent, type MountedRoot } from '@/sandbox/react-mount';
import { loadTailwind, waitForTailwind } from '@/sandbox/tailwind-loader';
import { installTimeController, type InstalledTimeController } from '@/sandbox/time-controller';

function stackOf(error: unknown): string | null {
  return error instanceof Error && typeof error.stack === 'string' ? error.stack : null;
}

/** The frame side of spec §6.3. Boots once per document (main.ts calls it); state resets per mount. */
export function startHarness(win: Window & typeof globalThis): void {
  const doc = win.document;
  const stage = doc.getElementById('stage');
  if (!(stage instanceof HTMLElement)) throw new Error('sandbox.html must contain <div id="stage">');

  const post = (message: FrameMessage): void => {
    win.parent.postMessage(message, win.origin);
  };

  // Natives captured before any clock install; the virtual clock patches rAF and now(), never
  // timers. `nativeSetTimeout` is the grade watchdog's timer (a virtual clock must never be able to
  // starve it) and `nativePerformanceNow` timestamps a report's `durationMs`.
  const nativeSetTimeout = win.setTimeout.bind(win);
  const nativePerformanceNow = win.performance.now.bind(win.performance);

  const loopGuard = installLoopGuard(win);

  // Timer LIFECYCLE tracking — not time virtualization; determinism still comes entirely from
  // TimeController (T8 deliberately never patches setTimeout/setInterval). User code may schedule
  // a real timer that outlives its own mount; without this, a stray timer from payload A firing
  // after payload B has been mounted would throw and post a `scope: 'mount'` error misattributed
  // to whichever payload happens to be live when it fires. Installed AFTER `installLoopGuard`
  // (whose own perpetual reset `setInterval` call above already ran through the untouched native,
  // so it is never tracked/cleared here) and before any user code can run (a mount only happens in
  // response to a 'mount' message, which cannot arrive before `ready` is posted at the end of this
  // function). `clearTimeout` and `clearInterval` are spec-interchangeable — both cancel either
  // kind of pending timer — so one native clear call retires any tracked id regardless of which
  // scheduling call created it.
  const nativeTimerSetTimeout = win.setTimeout.bind(win);
  const nativeTimerSetInterval = win.setInterval.bind(win);
  const nativeTimerClearTimeout = win.clearTimeout.bind(win);
  const nativeTimerClearInterval = win.clearInterval.bind(win);
  const trackedTimerIds = new Set<number>();
  win.setTimeout = (handler, timeout, ...args) => {
    const id = nativeTimerSetTimeout(handler, timeout, ...args);
    trackedTimerIds.add(id);
    return id;
  };
  win.setInterval = (handler, timeout, ...args) => {
    const id = nativeTimerSetInterval(handler, timeout, ...args);
    trackedTimerIds.add(id);
    return id;
  };
  win.clearTimeout = (id) => {
    if (id !== undefined) trackedTimerIds.delete(id);
    nativeTimerClearTimeout(id);
  };
  win.clearInterval = (id) => {
    if (id !== undefined) trackedTimerIds.delete(id);
    nativeTimerClearInterval(id);
  };

  let environment: SandboxEnvironment = DEFAULT_ENVIRONMENT;
  let lastMount: MountPayload | null = null;
  let installedTime: InstalledTimeController | null = null;
  let restoreMatchMedia: (() => void) | null = null;
  let blobUrls: string[] = [];
  let reactRoot: MountedRoot | null = null;
  let moduleExports: Readonly<Record<string, unknown>> = {};
  // Guards the timer-sweep hazard (spec §6.7): TimeController's `stepFrames`/`settle` pacing runs
  // its macrotasks through the timer-lifecycle wrapper below, so `resetStage()` clearing every
  // tracked timer id would cancel a LIVE grade's pending pacing timer out from under it. The host
  // protocol drives mount -> grade sequentially and never sends `mount`/`reset`/`replay` while a
  // grade is outstanding, so this should never trip; it exists as a defensive backstop in case a
  // future host bug (or a malformed/duplicated message) violates that invariant. `handle` never
  // serializes message processing (each arrival is dispatched via `void handle(message)`), so
  // without this flag such a message would run concurrently with `grade` instead of queuing.
  let gradeInFlight = false;

  // Console forwarding (spec §6.3): original behaviour intact, every level mirrored to the host.
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = win.console[level].bind(win.console);
    win.console[level] = (...args: unknown[]): void => {
      original(...args);
      post({ v: PROTOCOL_VERSION, type: 'console', level, text: args.map(safeString).join(' ') });
    };
  }

  const resetStage = (): void => {
    reactRoot?.unmount();
    reactRoot = null;
    stage.replaceChildren();
    for (const styleEl of Array.from(doc.querySelectorAll('style[data-sandbox-style]'))) styleEl.remove();
    for (const url of blobUrls) URL.revokeObjectURL(url);
    blobUrls = [];
    moduleExports = {};
    // Cancel every real timer the PREVIOUS payload left running, so it can never fire (and throw,
    // or otherwise touch state) against whatever payload is mounted next. Safe against the live
    // TimeController's own pacing: that controller's `nativeSetTimeout`-based macrotask helper is
    // captured fresh on each `installTimeController` call inside `mount()`, which always runs
    // AFTER this `resetStage()` — so there is nothing of the upcoming mount's to clear yet, and the
    // PRIOR mount's pacing is already abandoned (nothing still awaits it) by the time we get here.
    for (const id of trackedTimerIds) nativeTimerClearTimeout(id);
    trackedTimerIds.clear();
    loopGuard.reset();
    restoreMatchMedia?.();
    restoreMatchMedia = null;
    installedTime?.uninstall();
    installedTime = null;
  };

  const injectStyles = (payload: MountPayload): void => {
    for (const file of payload.cssFiles) {
      const styleEl = doc.createElement('style');
      if (payload.wantsTailwind) styleEl.setAttribute('type', 'text/tailwindcss');
      styleEl.setAttribute('data-sandbox-style', '');
      styleEl.textContent = file.source;
      doc.head.append(styleEl);
    }
  };

  // Both callees are idempotent, so this may re-run after a Tailwind recompile regenerates the
  // JIT's output sheet (which wipes earlier CSSOM edits to it).
  const applyEnvironmentToStyles = (): void => {
    if (environment.forcedReducedMotion !== null) applyForcedMediaToStyles(doc, environment.forcedReducedMotion);
    enableSimulatedHover(doc);
  };

  const mount = async (payload: MountPayload): Promise<void> => {
    resetStage();
    lastMount = payload;
    // Fake clock installed BEFORE user code executes (spec §6.1).
    const time = installTimeController(win, environment.clock);
    installedTime = time;
    if (environment.forcedReducedMotion !== null) {
      restoreMatchMedia = patchMatchMedia(win, environment.forcedReducedMotion);
    }
    if (payload.wantsTailwind) await loadTailwind(doc);
    injectStyles(payload);
    // Only the dom runtime mounts an html fragment; react owns the stage via createRoot (which
    // expects an empty container), and module renders nothing.
    if (payload.runtime === 'dom' && payload.htmlFile !== null) stage.innerHTML = payload.htmlFile.source;
    // The compile wait runs AFTER injection so the pass it proves covers THIS payload's classes;
    // the media flip and hover rewrite run after that so they see the JIT-generated rules
    // (motion-safe:/motion-reduce:/hover: variants), not only the hand-written ones.
    if (payload.wantsTailwind) await waitForTailwind(doc, time.nativeNextFrame);
    applyEnvironmentToStyles();
    if (payload.entryPath !== null) {
      const linked = linkModuleGraph(
        { modules: payload.modules, entryPath: payload.entryPath, cssPaths: payload.cssFiles.map((file) => file.path) },
        (code) => {
          const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
          blobUrls.push(url);
          return url;
        },
      );
      if (!linked.ok) throw new Error(linked.reason);
      const namespace: unknown = await import(/* @vite-ignore */ linked.entryUrl);
      if (payload.runtime === 'module') {
        moduleExports = toExportsRecord(namespace);
      } else if (payload.runtime === 'react') {
        const componentExport =
          typeof namespace === 'object' && namespace !== null && 'default' in namespace ? namespace.default : undefined;
        reactRoot = mountReactComponent(stage, componentExport, (error) => {
          post({
            v: PROTOCOL_VERSION,
            type: 'error',
            scope: 'mount',
            message: safeString(error),
            stack: stackOf(error),
          });
        });
      }
    }
    if (payload.wantsTailwind && payload.entryPath !== null) {
      // The entry module (a React render, DOM-building script) may add classes the earlier pass
      // never saw; the recompile regenerates the JIT output sheet, so wait again and re-apply the
      // idempotent style rewrites to the fresh rules.
      await waitForTailwind(doc, time.nativeNextFrame);
      applyEnvironmentToStyles();
    }
    // Two native frames so initial styles commit and transitions triggered by mount settle into rest.
    await time.nativeNextFrame();
    await time.nativeNextFrame();
    post({ v: PROTOCOL_VERSION, type: 'mounted', challengeId: payload.challengeId });
  };

  const grade = async (challengeId: string, timeoutMs: number): Promise<void> => {
    const payload = lastMount;
    if (installedTime === null || payload === null) {
      post({
        v: PROTOCOL_VERSION,
        type: 'error',
        scope: 'grade',
        message: 'grade requested before mount',
        stack: null,
      });
      return;
    }
    const startedAt = nativePerformanceNow();
    const log = new AssertionLog();
    const ctx = buildGradeContext({
      win,
      doc,
      stage,
      // Read per call: setReducedMotion remounts, which installs a fresh controller.
      time: () => {
        const current = installedTime;
        if (current === null) throw new Error('no time controller — the frame is between mounts');
        return current.controller;
      },
      nativeNextFrame: () => {
        const current = installedTime;
        if (current === null) throw new Error('no time controller — the frame is between mounts');
        return current.nativeNextFrame();
      },
      moduleExports: () => moduleExports,
      sources: payload.sources,
      log,
      environment: () => environment,
      remount: async (nextEnvironment) => {
        environment = nextEnvironment;
        await mount(payload);
      },
    });
    const grader = await loadGrader(challengeId);
    const outcome =
      grader === null
        ? {
            threw: {
              message: `no grader is registered for "${challengeId}" — expected src/challenges/${challengeId}.grade.ts`,
              stack: null,
            },
            timedOut: false,
          }
        : await runWithTimeout(grader(ctx), timeoutMs, nativeSetTimeout);
    const assertions = log.records;
    post({
      v: PROTOCOL_VERSION,
      type: 'graded',
      report: {
        challengeId,
        passed:
          assertions.length > 0 &&
          assertions.every((record) => record.ok) &&
          outcome.threw === null &&
          !outcome.timedOut,
        assertions,
        threw: outcome.threw,
        timedOut: outcome.timedOut,
        durationMs: nativePerformanceNow() - startedAt,
      },
    });
  };

  const handle = async (message: HostMessage): Promise<void> => {
    try {
      switch (message.type) {
        case 'setEnvironment':
          environment = message.environment;
          break;
        case 'mount':
          // See `gradeInFlight`'s declaration: the protocol never sends `mount` during a live
          // grade, but ignoring it here (rather than sweeping the grade's pacing timers via
          // `resetStage()`) turns a protocol violation into a loud host-side mount timeout instead
          // of a corrupted, hanging grade.
          if (gradeInFlight) break;
          await mount(message.mount);
          break;
        case 'grade':
          gradeInFlight = true;
          try {
            await grade(message.challengeId, message.timeoutMs);
          } finally {
            gradeInFlight = false;
          }
          break;
        case 'reset':
          // Same guard as 'mount' above — `resetStage()` is exactly the timer sweep the comment
          // on `gradeInFlight` warns about.
          if (gradeInFlight) break;
          resetStage();
          lastMount = null;
          break;
        case 'replay':
          // Same guard — `replay` re-enters `mount()`, which itself starts with `resetStage()`.
          if (gradeInFlight) break;
          if (lastMount !== null) await mount(lastMount);
          break;
      }
    } catch (error) {
      post({
        v: PROTOCOL_VERSION,
        type: 'error',
        scope: message.type === 'grade' ? 'grade' : 'mount',
        message: safeString(error),
        stack: stackOf(error),
      });
    }
  };

  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== win.parent) return;
    const message = parseHostMessage(event.data);
    if (message === null) {
      post({
        v: PROTOCOL_VERSION,
        type: 'error',
        scope: 'protocol',
        message: 'unrecognised host message',
        stack: null,
      });
      return;
    }
    void handle(message);
  });

  win.addEventListener('error', (event: ErrorEvent) => {
    post({ v: PROTOCOL_VERSION, type: 'error', scope: 'mount', message: event.message, stack: null });
  });
  win.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    post({ v: PROTOCOL_VERSION, type: 'error', scope: 'mount', message: safeString(event.reason), stack: null });
  });

  post({ v: PROTOCOL_VERSION, type: 'ready' });
}
