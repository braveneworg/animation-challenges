import { describe, expect, it } from 'vitest';

import { DEFAULT_GRADER_TIMEOUT_MS } from '@/challenges/types';
import {
  effectiveGraderTimeoutMs,
  summarizeReportFailures,
  timeoutFailureSummary,
  toRunSummary,
  toSubmitOutcome,
} from '@/features/workspace/grade-report-mapping';
import type { AssertionRecord, GradeRunReport } from '@/runner/types';
import { makeChallenge } from '@/test/challenge-fixture';

function report(overrides: Partial<GradeRunReport> = {}): GradeRunReport {
  const base: GradeRunReport = {
    challengeId: 'css-transitions/hover-lift',
    passed: false,
    assertions: [],
    threw: null,
    timedOut: false,
    durationMs: 120,
  };
  return Object.assign({}, base, overrides);
}

const failing: AssertionRecord = {
  ok: false,
  message: 'The card should rise on hover',
  hint: 'Transition transform, not top',
  actual: 'matrix(1, 0, 0, 1, 0, 0)',
  expected: 'a negative Y translation',
};
const failingWithoutValues: AssertionRecord = {
  ok: false,
  message: 'The shadow should deepen',
  hint: 'Transition box-shadow explicitly',
  actual: null,
  expected: null,
};
const passing: AssertionRecord = { ok: true, message: 'ok', hint: 'ok', actual: null, expected: null };

describe('effectiveGraderTimeoutMs', () => {
  it('lets the per-challenge override beat the settings value', () => {
    const challenge = makeChallenge('css-transitions/hover-lift', { graderTimeoutMs: 12_000 });
    expect(effectiveGraderTimeoutMs(challenge, 8000)).toBe(12_000);
  });

  it('uses the settings value when the challenge has no override', () => {
    expect(effectiveGraderTimeoutMs(makeChallenge('a/b'), 8000)).toBe(8000);
  });

  it('falls back to DEFAULT_GRADER_TIMEOUT_MS when both are absent', () => {
    expect(effectiveGraderTimeoutMs(makeChallenge('a/b'), undefined)).toBe(DEFAULT_GRADER_TIMEOUT_MS);
  });
});

describe('summarizeReportFailures', () => {
  it('maps failing assertions to FailureSummary, dropping nulls to undefined', () => {
    const failures = summarizeReportFailures(report({ assertions: [passing, failing, failingWithoutValues] }), 5000);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toEqual({
      message: 'The card should rise on hover',
      hint: 'Transition transform, not top',
      actual: 'matrix(1, 0, 0, 1, 0, 0)',
      expected: 'a negative Y translation',
    });
    expect(failures[1]?.actual).toBeUndefined();
    expect(failures[1]?.expected).toBeUndefined();
  });

  it('REGRESSION: a threw run with zero assertions synthesizes a failure instead of persisting []', () => {
    const failures = summarizeReportFailures(
      report({ threw: { message: 'Cannot read properties of null', stack: null } }),
      5000,
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]?.message).toBe('Cannot read properties of null');
    expect(failures[0]?.hint).toBeTruthy();
  });

  it('REGRESSION: a timed-out run with zero assertions synthesizes the fixed timeout message', () => {
    const failures = summarizeReportFailures(report({ timedOut: true }), 7000);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe('grading timed out after 7000ms');
  });

  it('a frame-side soft timeout keeps partial assertions AND appends the timeout summary', () => {
    const failures = summarizeReportFailures(report({ timedOut: true, assertions: [failing, passing] }), 5000);
    expect(failures).toHaveLength(2);
    expect(failures[0]?.message).toBe('The card should rise on hover');
    expect(failures[1]?.message).toBe('grading timed out after 5000ms');
  });

  it('a throw after recorded assertions reports both', () => {
    const failures = summarizeReportFailures(
      report({ assertions: [failing], threw: { message: 'stage element missing', stack: 'stack' } }),
      5000,
    );
    expect(failures.map((failure) => failure.message)).toEqual([
      'The card should rise on hover',
      'stage element missing',
    ]);
  });

  it('a failed report with no assertions, no throw, no timeout still yields a failure (zero-assertion grader)', () => {
    const failures = summarizeReportFailures(report({}), 5000);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]?.hint).toBeTruthy();
  });

  it('a passed report yields no failures', () => {
    expect(summarizeReportFailures(report({ passed: true, assertions: [passing] }), 5000)).toEqual([]);
  });
});

describe('shaping helpers', () => {
  it('timeoutFailureSummary uses the effective budget in its message', () => {
    expect(timeoutFailureSummary(12_000).message).toBe('grading timed out after 12000ms');
  });

  it('toRunSummary and toSubmitOutcome carry the report through', () => {
    const graded = report({ passed: true, assertions: [passing], durationMs: 321 });
    expect(toRunSummary(graded, [], '2026-08-10T00:00:00.000Z')).toEqual({
      passed: true,
      failures: [],
      durationMs: 321,
      completedAt: '2026-08-10T00:00:00.000Z',
    });
    expect(toSubmitOutcome(graded, [])).toEqual({
      challengeId: 'css-transitions/hover-lift',
      passed: true,
      failures: [],
      durationMs: 321,
    });
  });
});
