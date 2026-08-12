import { describe, expect, it } from 'vitest';

import type { SubmitOutcome } from '@/data/operations';
import {
  performSubmit,
  rubricFailOutcome,
  rubricPassOutcome,
  type SubmitDeps,
  type SubmitFlowResult,
} from '@/features/workspace/submit-flow';
import type { RunGradeOptions } from '@/runner/run-grade';
import type { GradeRunReport, PrepareResult } from '@/runner/types';
import { makeChallenge } from '@/test/challenge-fixture';

interface FakeDeps extends SubmitDeps {
  gradeOptions: RunGradeOptions[];
  recorded: SubmitOutcome[];
}

function fakeDeps(prepareResult: PrepareResult, report: GradeRunReport): FakeDeps {
  const deps: FakeDeps = {
    gradeOptions: [],
    recorded: [],
    prepare: () => Promise.resolve(prepareResult),
    runGrade: (options) => {
      deps.gradeOptions.push(options);
      return Promise.resolve(report);
    },
    recordOutcome: (outcome) => {
      deps.recorded.push(outcome);
      return Promise.resolve(undefined);
    },
    nowIso: () => '2026-08-10T00:00:00.000Z',
  };
  return deps;
}

const okPrepare: PrepareResult = {
  ok: true,
  submission: { modules: [], cssFiles: [], htmlFile: null, entryPath: null, sources: {} },
};

function gradeReport(overrides: Partial<GradeRunReport> = {}): GradeRunReport {
  const base: GradeRunReport = {
    challengeId: 'css-transitions/hover-lift',
    passed: false,
    assertions: [{ ok: false, message: 'The card should rise', hint: 'Use transform', actual: null, expected: null }],
    threw: null,
    timedOut: false,
    durationMs: 200,
  };
  return Object.assign({}, base, overrides);
}

function assertGraded(result: SubmitFlowResult): asserts result is Extract<SubmitFlowResult, { kind: 'graded' }> {
  if (result.kind !== 'graded') throw new Error(`expected a graded result, got ${result.kind}`);
}

describe('performSubmit', () => {
  it('returns diagnostics and records NOTHING when the files do not transpile (spec §6.7: no mount)', async () => {
    const deps = fakeDeps(
      { ok: false, diagnostics: [{ path: 'index.ts', message: 'Unexpected token', line: 1, column: 0 }] },
      gradeReport(),
    );
    const result = await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift'),
      files: { 'index.ts': 'const =' },
      settingsTimeoutMs: 5000,
    });
    expect(result.kind).toBe('transpile-error');
    expect(deps.recorded).toHaveLength(0);
    expect(deps.gradeOptions).toHaveLength(0);
  });

  it('passes settings.graderTimeoutMs to runGrade as defaultTimeoutMs (seam obligation)', async () => {
    const deps = fakeDeps(okPrepare, gradeReport());
    await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift'),
      files: {},
      settingsTimeoutMs: 9000,
    });
    expect(deps.gradeOptions).toHaveLength(1);
    expect(deps.gradeOptions[0]?.defaultTimeoutMs).toBe(9000);
  });

  it('records a failed auto run with mapped failures', async () => {
    const deps = fakeDeps(okPrepare, gradeReport());
    const result = await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift'),
      files: {},
      settingsTimeoutMs: 5000,
    });
    assertGraded(result);
    expect(result.recorded).toBe(true);
    expect(deps.recorded).toHaveLength(1);
    expect(deps.recorded[0]?.passed).toBe(false);
    expect(deps.recorded[0]?.failures[0]?.message).toBe('The card should rise');
    expect(result.summary.completedAt).toBe('2026-08-10T00:00:00.000Z');
  });

  it('REGRESSION: a timed-out run persists a synthesized failure whose message uses the per-challenge budget', async () => {
    const deps = fakeDeps(okPrepare, gradeReport({ assertions: [], timedOut: true }));
    await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift', { graderTimeoutMs: 12_000 }),
      files: {},
      settingsTimeoutMs: 5000,
    });
    expect(deps.recorded[0]?.failures).toHaveLength(1);
    expect(deps.recorded[0]?.failures[0]?.message).toBe('grading timed out after 12000ms');
  });

  it('records a passing auto run with empty failures', async () => {
    const deps = fakeDeps(okPrepare, gradeReport({ passed: true, assertions: [] }));
    const result = await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift'),
      files: {},
      settingsTimeoutMs: 5000,
    });
    assertGraded(result);
    expect(deps.recorded[0]?.passed).toBe(true);
    expect(deps.recorded[0]?.failures).toEqual([]);
  });

  it('defers recording when a hybrid grader passes (rubric confirmation still owed)', async () => {
    const deps = fakeDeps(okPrepare, gradeReport({ passed: true, assertions: [] }));
    const result = await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift', {
        gradeMode: 'hybrid',
        rubric: [{ id: 'feel', label: 'Feels springy' }],
      }),
      files: {},
      settingsTimeoutMs: 5000,
    });
    assertGraded(result);
    expect(result.recorded).toBe(false);
    expect(deps.recorded).toHaveLength(0);
  });

  it('records immediately when a hybrid grader fails', async () => {
    const deps = fakeDeps(okPrepare, gradeReport());
    const result = await performSubmit(deps, {
      challenge: makeChallenge('css-transitions/hover-lift', {
        gradeMode: 'hybrid',
        rubric: [{ id: 'feel', label: 'Feels springy' }],
      }),
      files: {},
      settingsTimeoutMs: 5000,
    });
    assertGraded(result);
    expect(result.recorded).toBe(true);
    expect(deps.recorded).toHaveLength(1);
  });
});

describe('rubric outcomes', () => {
  it('rubricPassOutcome records a pass with no failures', () => {
    expect(rubricPassOutcome('a/b', 250)).toEqual({ challengeId: 'a/b', passed: true, failures: [], durationMs: 250 });
  });

  it('rubricFailOutcome turns unchecked items into hinted failures', () => {
    const outcome = rubricFailOutcome(
      'a/b',
      [
        { id: 'feel', label: 'Feels springy', detail: 'Overshoots once then settles' },
        { id: 'snap', label: 'No snap' },
      ],
      0,
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toHaveLength(2);
    expect(outcome.failures[0]).toEqual({
      message: 'Rubric item not confirmed: Feels springy',
      hint: 'Overshoots once then settles',
    });
    expect(outcome.failures[1]?.hint).toBeTruthy();
  });
});
