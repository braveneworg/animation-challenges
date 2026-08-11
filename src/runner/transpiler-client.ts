import type { ChallengeFiles, RuntimeKind } from '@/challenges/types';
import type { PrepareResult } from '@/runner/types';
import { prepareResponseSchema } from '@/runner/worker-protocol';

interface PendingRequest {
  resolve: (result: PrepareResult) => void;
  reject: (error: Error) => void;
}

/**
 * Owns the transpile Web Worker. Requires http(s) serving like everything else in the runner;
 * `new URL(..., import.meta.url)` is the Vite-blessed worker instantiation and is rewritten at
 * build time. Call `dispose()` when done — the catalog suite and `runGrade` create short-lived
 * clients, the workspace UI (Plan 05) keeps one for the session.
 */
export class TranspilerClient {
  #worker: Worker;
  #nextRequestId = 1;
  #pending = new Map<number, PendingRequest>();

  constructor() {
    this.#worker = new Worker(new URL('./transpile.worker.ts', import.meta.url), { type: 'module' });
    this.#worker.addEventListener('message', (event: MessageEvent) => {
      const parsed = prepareResponseSchema.safeParse(event.data);
      if (!parsed.success) {
        // A malformed response cannot be correlated to a request, so no pending promise could ever
        // settle — a protocol bug between our own worker and client must be loud, never a silent hang.
        for (const [requestId, pending] of this.#pending) {
          this.#pending.delete(requestId);
          pending.reject(
            new Error('transpile worker sent an unrecognisable response — worker/client protocol mismatch'),
          );
        }
        return;
      }
      const pending = this.#pending.get(parsed.data.requestId);
      if (pending === undefined) return;
      this.#pending.delete(parsed.data.requestId);
      pending.resolve(parsed.data.result);
    });
    this.#worker.addEventListener('error', (event: ErrorEvent) => {
      for (const [requestId, pending] of this.#pending) {
        this.#pending.delete(requestId);
        pending.reject(new Error(`transpile worker failed: ${event.message}`));
      }
    });
  }

  prepare(files: ChallengeFiles, runtime: RuntimeKind): Promise<PrepareResult> {
    const requestId = this.#nextRequestId;
    this.#nextRequestId += 1;
    return new Promise<PrepareResult>((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      this.#worker.postMessage({ requestId, files: { ...files }, runtime });
    });
  }

  dispose(): void {
    this.#worker.terminate();
    for (const [requestId, pending] of this.#pending) {
      this.#pending.delete(requestId);
      pending.reject(new Error('transpiler client disposed'));
    }
  }
}
