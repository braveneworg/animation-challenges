import { safeString } from '@/runner/safe-string';

export interface TimedOutcome {
  threw: { message: string; stack: string | null } | null;
  timedOut: boolean;
}

/**
 * Races `work` against a timeout and NEVER rejects — grading always produces a report (spec §6.7).
 * The timer function is injectable: unit tests pass fakes; the frame passes its captured NATIVE
 * setTimeout so a virtual clock cannot starve the watchdog.
 */
export function runWithTimeout(
  work: Promise<void>,
  timeoutMs: number,
  setTimeoutFn: (callback: () => void, ms: number) => unknown = (callback, ms) => setTimeout(callback, ms),
): Promise<TimedOutcome> {
  return new Promise<TimedOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: TimedOutcome): void => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    setTimeoutFn(() => {
      finish({ threw: null, timedOut: true });
    }, timeoutMs);
    work.then(
      () => {
        finish({ threw: null, timedOut: false });
        return undefined;
      },
      (error: unknown) => {
        finish({
          threw: {
            message: error instanceof Error ? error.message : safeString(error),
            stack: error instanceof Error && typeof error.stack === 'string' ? error.stack : null,
          },
          timedOut: false,
        });
        return undefined;
      },
    );
  });
}
