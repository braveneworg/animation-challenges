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
import { safeString } from '@/runner/safe-string';
import { applyForcedMediaToStyles, enableSimulatedHover, patchMatchMedia } from '@/sandbox/environment';
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

  // Natives captured before any clock install; the virtual clock patches rAF and now(), never timers.
  const nativeSetTimeout = win.setTimeout.bind(win);
  const nativePerformanceNow = win.performance.now.bind(win.performance);
  void nativeSetTimeout; // used by Task 13's grade wiring
  void nativePerformanceNow;

  const loopGuard = installLoopGuard(win);

  let environment: SandboxEnvironment = DEFAULT_ENVIRONMENT;
  let lastMount: MountPayload | null = null;
  let installedTime: InstalledTimeController | null = null;
  let restoreMatchMedia: (() => void) | null = null;
  let blobUrls: string[] = [];
  let reactRoot: MountedRoot | null = null;
  let moduleExports: Readonly<Record<string, unknown>> = {};
  void moduleExports; // read by Task 13's grade wiring; assigned now so `mount`'s shape is already final

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

  const handle = async (message: HostMessage): Promise<void> => {
    try {
      switch (message.type) {
        case 'setEnvironment':
          environment = message.environment;
          break;
        case 'mount':
          await mount(message.mount);
          break;
        case 'grade':
          post({
            v: PROTOCOL_VERSION,
            type: 'error',
            scope: 'grade',
            message: 'grading is not wired yet',
            stack: null,
          });
          break;
        case 'reset':
          resetStage();
          lastMount = null;
          break;
        case 'replay':
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
