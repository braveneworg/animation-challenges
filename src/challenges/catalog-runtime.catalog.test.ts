import { describe, expect, test } from 'vitest';

import { CATALOG_TEST_TIMEOUT_MS } from '@/challenges/catalog-timeouts';
import { challengeRegistry } from '@/challenges/registry';
import { DEFAULT_GRADER_TIMEOUT_MS } from '@/challenges/types';
import { prepareSubmission } from '@/runner/pipeline';
import { runGrade } from '@/runner/run-grade';
import type { AssertionRecord, GradeRunReport } from '@/runner/types';
import { graderIds } from '@/sandbox/grader-registry';

const { challenges } = challengeRegistry;
const autoGraded = challenges.filter((challenge) => challenge.gradeMode !== 'rubric');
const rubricOnly = challenges.filter((challenge) => challenge.gradeMode === 'rubric');

// vitest.config.ts imports the SAME `CATALOG_TEST_TIMEOUT_MS` (from '@/challenges/catalog-timeouts')
// for the catalog project's `testTimeout`, so the two ceilings can never drift independently. Rule
// 5/6 below pass `graderTimeoutMs + GRADE_RUN_MARGIN_MS` as their OWN per-test override, and vitest
// honors an override even past the project ceiling — so the ceiling config alone cannot stop a
// future challenge from quietly requesting a longer run. The `toBeLessThanOrEqual` guard inside
// each test body below is what actually enforces the budget, and it fails before the expensive
// grade run rather than after a mysterious 60s timeout.
const GRADE_RUN_MARGIN_MS = 20_000;
const MAX_GRADER_TIMEOUT_MS = CATALOG_TEST_TIMEOUT_MS - GRADE_RUN_MARGIN_MS;

/** Evidence surfaced by a failing rule-6 assertion — enough for a maintainer to diagnose from CI output alone. */
interface StarterFailureEvidence {
  threw: GradeRunReport['threw'];
  hintedFailures: readonly AssertionRecord[];
  allAssertions: readonly AssertionRecord[];
}

test('the registry is clean and non-empty', () => {
  expect(challengeRegistry.errors).toEqual([]);
  expect(challenges.length).toBeGreaterThan(0);
});

describe('rule 3: starter and solution both transpile (spec §8.2)', () => {
  for (const challenge of challenges) {
    test(`${challenge.id} starter`, () => {
      const result = prepareSubmission(challenge.starter, challenge.runtime);
      expect(result.ok ? [] : result.diagnostics).toEqual([]);
    });
    test(`${challenge.id} solution`, () => {
      const result = prepareSubmission(challenge.solution, challenge.runtime);
      expect(result.ok ? [] : result.diagnostics).toEqual([]);
    });
  }
});

describe('grader files match gradeMode', () => {
  for (const challenge of autoGraded) {
    test(`${challenge.id} (${challenge.gradeMode}) has a grader`, () => {
      expect(graderIds).toContain(challenge.id);
    });
  }
  for (const challenge of rubricOnly) {
    test(`${challenge.id} (rubric) must NOT have a grader`, () => {
      expect(graderIds).not.toContain(challenge.id);
    });
  }
});

describe('rule 5: the reference solution passes its own grader (spec §8.2)', () => {
  for (const challenge of autoGraded) {
    const timeoutMs = challenge.graderTimeoutMs ?? DEFAULT_GRADER_TIMEOUT_MS;
    test(
      `${challenge.id} (solution)`,
      async () => {
        // Catches a challenge whose graderTimeoutMs would push this test's own override past the
        // catalog project's 60s ceiling — see the constants above.
        expect(timeoutMs).toBeLessThanOrEqual(MAX_GRADER_TIMEOUT_MS);
        const report = await runGrade({ challenge, files: challenge.solution });
        expect(report.assertions.filter((assertion) => !assertion.ok)).toEqual([]);
        expect(report.threw).toBeNull();
        expect(report.timedOut).toBe(false);
        expect(report.passed).toBe(true);
      },
      timeoutMs + GRADE_RUN_MARGIN_MS,
    );
  }
});

describe('rule 6: the starter fails its own grader (spec §8.2)', () => {
  for (const challenge of autoGraded) {
    const timeoutMs = challenge.graderTimeoutMs ?? DEFAULT_GRADER_TIMEOUT_MS;
    test(
      `${challenge.id} (starter)`,
      async () => {
        // Catches a challenge whose graderTimeoutMs would push this test's own override past the
        // catalog project's 60s ceiling — see the constants above.
        expect(timeoutMs).toBeLessThanOrEqual(MAX_GRADER_TIMEOUT_MS);
        const report = await runGrade({ challenge, files: challenge.starter });
        expect(report.passed).toBe(false);
        const failures = report.assertions.filter((assertion) => !assertion.ok);
        // A grader that asserts nothing would "fail" only via the no-assertions guard; require a
        // real, hinted failure so starters teach from the first submit. Asserting on the evidence
        // object (not a collapsed boolean) is deliberate: `toSatisfy` prints the whole object on
        // failure, so a maintainer sees every recorded assertion and hint straight from CI output
        // instead of a bare `expected false to be true`.
        const hinted = failures.filter((assertion) => assertion.hint.length > 0);
        const evidence: StarterFailureEvidence = {
          threw: report.threw,
          hintedFailures: hinted,
          allAssertions: report.assertions,
        };
        expect(evidence).toSatisfy(
          (value: StarterFailureEvidence) => value.threw !== null || value.hintedFailures.length > 0,
        );
      },
      timeoutMs + GRADE_RUN_MARGIN_MS,
    );
  }
});
