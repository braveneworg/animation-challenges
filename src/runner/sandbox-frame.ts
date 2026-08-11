import {
  DEFAULT_ENVIRONMENT,
  parseFrameMessage,
  PROTOCOL_VERSION,
  type FrameMessage,
  type HostMessage,
  type MountPayload,
  type SandboxEnvironment,
} from '@/runner/protocol';
import type { GradeRunReport } from '@/runner/types';

export const DEFAULT_SANDBOX_URL = '/sandbox.html';
export const READY_TIMEOUT_MS = 5000;
export const MOUNT_TIMEOUT_MS = 15_000;
/** The host's hard backstop past the frame's own grader timeout (spec §6.7). */
export const HOST_TIMEOUT_MARGIN_MS = 2000;

export interface SandboxFrameOptions {
  sandboxUrl?: string | undefined;
  container?: HTMLElement | undefined;
  environment?: SandboxEnvironment | undefined;
  readyTimeoutMs?: number | undefined;
}

type FrameListener = (message: FrameMessage) => void;

/**
 * Host-side controller for one sandbox iframe. The frame is offscreen but RENDERED — never
 * display:none, which suppresses layout and animations, and grading reads both. A missing `ready`
 * handshake tears the frame down and recreates it once (spec §6.7) before rejecting.
 */
export class SandboxFrame {
  #iframe: HTMLIFrameElement;
  #listeners = new Set<FrameListener>();
  #dispatch: (event: MessageEvent) => void;
  #alive = true;

  private constructor(iframe: HTMLIFrameElement, environment: SandboxEnvironment) {
    this.#iframe = iframe;
    this.#dispatch = (event: MessageEvent): void => {
      if (event.source !== this.#iframe.contentWindow) return;
      const message = parseFrameMessage(event.data);
      if (message === null) return;
      for (const listener of [...this.#listeners]) listener(message);
    };
    window.addEventListener('message', this.#dispatch);
    this.setEnvironment(environment);
  }

  static async create(options?: SandboxFrameOptions): Promise<SandboxFrame> {
    try {
      return await SandboxFrame.#createOnce(options);
    } catch {
      return SandboxFrame.#createOnce(options);
    }
  }

  static #createOnce(options?: SandboxFrameOptions): Promise<SandboxFrame> {
    const environment = options?.environment ?? DEFAULT_ENVIRONMENT;
    const readyTimeoutMs = options?.readyTimeoutMs ?? READY_TIMEOUT_MS;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'visible';
    iframe.style.width = `${environment.viewport.width}px`;
    iframe.style.height = `${environment.viewport.height}px`;
    return new Promise<SandboxFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        iframe.remove();
        reject(new Error('sandbox frame never posted ready'));
      }, readyTimeoutMs);
      const onMessage = (event: MessageEvent): void => {
        if (event.source !== iframe.contentWindow) return;
        const message = parseFrameMessage(event.data);
        if (message?.type !== 'ready') return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(new SandboxFrame(iframe, environment));
      };
      window.addEventListener('message', onMessage);
      (options?.container ?? document.body).append(iframe);
      iframe.src = options?.sandboxUrl ?? DEFAULT_SANDBOX_URL;
    });
  }

  get isAlive(): boolean {
    return this.#alive;
  }

  onMessage(listener: FrameListener): () => void {
    this.#listeners.add(listener);
    return (): void => {
      this.#listeners.delete(listener);
    };
  }

  #post(message: HostMessage): void {
    this.#iframe.contentWindow?.postMessage(message, window.origin);
  }

  setEnvironment(environment: SandboxEnvironment): void {
    this.#iframe.style.width = `${environment.viewport.width}px`;
    this.#iframe.style.height = `${environment.viewport.height}px`;
    this.#post({ v: PROTOCOL_VERSION, type: 'setEnvironment', environment });
  }

  mount(payload: MountPayload): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error('sandbox mount timed out'));
      }, MOUNT_TIMEOUT_MS);
      const unsubscribe = this.onMessage((message) => {
        if (message.type === 'mounted' && message.challengeId === payload.challengeId) {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        } else if (message.type === 'error' && message.scope === 'mount') {
          clearTimeout(timer);
          unsubscribe();
          reject(new Error(message.message));
        }
      });
      this.#post({ v: PROTOCOL_VERSION, type: 'mount', mount: payload });
    });
  }

  /**
   * Resolves with the frame's report; the frame itself enforces `timeoutMs` and reports partial
   * assertions. If the frame froze past the loop guard, the hard backstop at
   * `timeoutMs + HOST_TIMEOUT_MARGIN_MS` resolves with a synthetic timed-out report and marks the
   * frame dead — create a fresh frame afterwards.
   */
  grade(challengeId: string, timeoutMs: number): Promise<GradeRunReport> {
    const startedAt = performance.now();
    return new Promise<GradeRunReport>((resolve) => {
      // Funnelled through one call site: oxlint's `promise/no-multiple-resolved` flags multiple
      // textual `resolve(...)` calls inside one executor, even though these three branches are
      // mutually exclusive at runtime — each clears the other two via `clearTimeout`/`unsubscribe`
      // before it ever runs. `settle` is the sole place that touches the real `resolve`.
      const settle = (report: GradeRunReport): void => {
        resolve(report);
      };
      const timer = setTimeout(() => {
        unsubscribe();
        this.#alive = false;
        settle({
          challengeId,
          passed: false,
          assertions: [],
          threw: {
            message: 'the sandbox frame stopped responding and was discarded (possible runaway code)',
            stack: null,
          },
          timedOut: true,
          durationMs: performance.now() - startedAt,
        });
      }, timeoutMs + HOST_TIMEOUT_MARGIN_MS);
      const unsubscribe = this.onMessage((message) => {
        if (message.type === 'graded' && message.report.challengeId === challengeId) {
          clearTimeout(timer);
          unsubscribe();
          settle(message.report);
        } else if (message.type === 'error' && message.scope === 'grade') {
          clearTimeout(timer);
          unsubscribe();
          settle({
            challengeId,
            passed: false,
            assertions: [],
            threw: { message: message.message, stack: message.stack },
            timedOut: false,
            durationMs: performance.now() - startedAt,
          });
        }
      });
      this.#post({ v: PROTOCOL_VERSION, type: 'grade', challengeId, timeoutMs });
    });
  }

  reset(): void {
    this.#post({ v: PROTOCOL_VERSION, type: 'reset' });
  }

  replay(): void {
    this.#post({ v: PROTOCOL_VERSION, type: 'replay' });
  }

  destroy(): void {
    window.removeEventListener('message', this.#dispatch);
    this.#listeners.clear();
    this.#iframe.remove();
    this.#alive = false;
  }
}
