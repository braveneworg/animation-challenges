import { DEFAULT_GRADER_TIMEOUT_MS, type Challenge, type ChallengeFiles } from '@/challenges/types';
import { DEFAULT_ENVIRONMENT, toMountPayload, type SandboxEnvironment } from '@/runner/protocol';
import { safeString } from '@/runner/safe-string';
import { SandboxFrame } from '@/runner/sandbox-frame';
import { TranspilerClient } from '@/runner/transpiler-client';
import type { GradeRunReport, TranspileDiagnostic } from '@/runner/types';

export interface RunGradeOptions {
  challenge: Challenge;
  /** The candidate files: starter, solution, or the user's draft. */
  files: ChallengeFiles;
  environment?: Partial<SandboxEnvironment> | undefined;
  /** The caller's settings-level timeout default (Plan 04's `settings.graderTimeoutMs`). Per-challenge `graderTimeoutMs` always wins; absent both, `DEFAULT_GRADER_TIMEOUT_MS`. */
  defaultTimeoutMs?: number | undefined;
  sandboxUrl?: string | undefined;
  container?: HTMLElement | undefined;
}

function failureReport(challengeId: string, message: string): GradeRunReport {
  return {
    challengeId,
    passed: false,
    assertions: [],
    threw: { message, stack: null },
    timedOut: false,
    durationMs: 0,
  };
}

function describeDiagnostics(diagnostics: readonly TranspileDiagnostic[]): string {
  return diagnostics.map((d) => `${d.path}:${d.line ?? '?'}:${d.column ?? '?'} ${d.message}`).join('; ');
}

/**
 * One-shot grading (spec §6.1): prepare in the worker, mount in a fresh hidden frame, grade, tear
 * down. Submit and the catalog suite use this; the workspace UI (Plan 05) keeps its own long-lived
 * TranspilerClient and SandboxFrame instead. Never rejects — every failure mode becomes a report.
 */
export async function runGrade(options: RunGradeOptions): Promise<GradeRunReport> {
  const environment: SandboxEnvironment = { ...DEFAULT_ENVIRONMENT, ...options.environment };
  const client = new TranspilerClient();
  try {
    const prepared = await client.prepare(options.files, options.challenge.runtime);
    if (!prepared.ok) {
      return failureReport(options.challenge.id, `did not transpile: ${describeDiagnostics(prepared.diagnostics)}`);
    }
    const frame = await SandboxFrame.create({
      sandboxUrl: options.sandboxUrl,
      container: options.container,
      environment,
    });
    try {
      await frame.mount(toMountPayload(options.challenge, prepared.submission));
      const timeoutMs = options.challenge.graderTimeoutMs ?? options.defaultTimeoutMs ?? DEFAULT_GRADER_TIMEOUT_MS;
      return await frame.grade(options.challenge.id, timeoutMs);
    } finally {
      frame.destroy();
    }
  } catch (error) {
    // The outer catch is what makes the "never rejects" contract true: client.prepare (a broken
    // worker) and SandboxFrame.create (a failed handshake) reject OUTSIDE any inner handler, and
    // Plan 05 builds Submit on receiving a report, never an exception.
    return failureReport(options.challenge.id, error instanceof Error ? error.message : safeString(error));
  } finally {
    client.dispose();
  }
}
