import { useCallback, useEffect, useRef, useState } from 'react';

import type { MountPayload, SandboxEnvironment } from '@/runner/protocol';
import { SandboxFrame } from '@/runner/sandbox-frame';

export type PreviewFrameStatus = 'creating' | 'ready' | 'failed';

export interface ConsoleLine {
  /**
   * Stable identity for list rendering. Console output legitimately repeats (the same log line
   * fires every animation frame), so content alone can't key a list — and truncation at
   * MAX_CONSOLE_LINES shifts array indices, so position can't either.
   */
  id: string;
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

export interface PreviewFrameApi {
  status: PreviewFrameStatus;
  containerRef: React.RefObject<HTMLDivElement | null>;
  consoleLines: readonly ConsoleLine[];
  mount(payload: MountPayload): void;
  clearConsole(): void;
  recreate(): void;
}

const MAX_CONSOLE_LINES = 200;

/**
 * SandboxFrame styles its iframe offscreen (its grading default). The preview owns the container,
 * so it restyles the iframe IN PLACE into the visible flow and titles it — deliberately never
 * re-parenting it, because moving an iframe reloads its document. Width/height stay at the
 * deterministic viewport SandboxFrame set — the container scrolls instead of distorting layout.
 */
export function revealPreviewIframe(container: HTMLElement): void {
  const iframe = container.querySelector('iframe');
  if (!(iframe instanceof HTMLIFrameElement)) return;
  iframe.style.position = 'static';
  iframe.style.left = 'auto';
  iframe.style.maxWidth = '100%';
  iframe.title = 'Challenge preview';
}

/**
 * Spec §7.3: frame status lives in a hook, not the store. The frame is (re)created whenever
 * `environment` identity changes or `recreate` bumps the generation; the last mounted payload is
 * remembered and automatically remounted, because setEnvironment must precede mount (spec §6.3).
 *
 * `options.environment` MUST be referentially stable across renders (e.g. wrap it in `useMemo`).
 * It is an effect dependency, so a new object identity on every render — even with identical
 * field values — tears the frame down and recreates it on every render, never settling.
 */
export function usePreviewFrame(options: { environment: SandboxEnvironment; enabled: boolean }): PreviewFrameApi {
  const { environment, enabled } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<SandboxFrame | null>(null);
  const payloadRef = useRef<MountPayload | null>(null);
  const [status, setStatus] = useState<PreviewFrameStatus>('creating');
  const [consoleLines, setConsoleLines] = useState<readonly ConsoleLine[]>([]);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const container = containerRef.current;
    if (container === null) return undefined;
    let cancelled = false;
    let created: SandboxFrame | null = null;
    let unsubscribe: (() => void) | null = null;
    setStatus('creating');
    void SandboxFrame.create({ container, environment })
      .then((frame) => {
        // promise/always-return: every path through this callback returns explicitly (undefined
        // either way) rather than mixing an early bare `return;` with an implicit fall-through —
        // a behavior-neutral restructure of the brief's literal early-return guard.
        if (cancelled) {
          frame.destroy();
          return undefined;
        }
        created = frame;
        frameRef.current = frame;
        revealPreviewIframe(container);
        unsubscribe = frame.onMessage((message) => {
          if (message.type === 'console') {
            setConsoleLines((lines) =>
              [...lines, { id: crypto.randomUUID(), level: message.level, text: message.text }].slice(
                -MAX_CONSOLE_LINES,
              ),
            );
          } else if (message.type === 'error') {
            setConsoleLines((lines) =>
              [
                ...lines,
                { id: crypto.randomUUID(), level: 'error' as const, text: `[${message.scope}] ${message.message}` },
              ].slice(-MAX_CONSOLE_LINES),
            );
          }
        });
        setStatus('ready');
        const payload = payloadRef.current;
        if (payload !== null) {
          void frame.mount(payload).catch(() => setStatus('failed'));
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });
    return (): void => {
      cancelled = true;
      unsubscribe?.();
      created?.destroy();
      frameRef.current = null;
    };
  }, [enabled, environment, generation]);

  const mount = useCallback((payload: MountPayload): void => {
    payloadRef.current = payload;
    setConsoleLines([]);
    const frame = frameRef.current;
    if (frame === null || !frame.isAlive) {
      setGeneration((value) => value + 1); // recreate; the effect remounts payloadRef
      return;
    }
    void frame.mount(payload).catch(() => setStatus('failed'));
  }, []);

  const clearConsole = useCallback(() => setConsoleLines([]), []);
  const recreate = useCallback(() => setGeneration((value) => value + 1), []);

  return { status, containerRef, consoleLines, mount, clearConsole, recreate };
}
