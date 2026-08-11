import { describe, expect, test } from 'vitest';

import { challengeRegistry } from '@/challenges/registry';
import { DEFAULT_GRADER_TIMEOUT_MS } from '@/challenges/types';
import { prepareSubmission } from '@/runner/pipeline';
import { runGrade } from '@/runner/run-grade';
import { graderIds } from '@/sandbox/grader-registry';

const { challenges } = challengeRegistry;
const autoGraded = challenges.filter((challenge) => challenge.gradeMode !== 'rubric');
const rubricOnly = challenges.filter((challenge) => challenge.gradeMode === 'rubric');

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
    test(
      `${challenge.id} (solution)`,
      async () => {
        const report = await runGrade({ challenge, files: challenge.solution });
        expect(report.assertions.filter((assertion) => !assertion.ok)).toEqual([]);
        expect(report.threw).toBeNull();
        expect(report.timedOut).toBe(false);
        expect(report.passed).toBe(true);
      },
      (challenge.graderTimeoutMs ?? DEFAULT_GRADER_TIMEOUT_MS) + 20_000,
    );
  }
});

describe('rule 6: the starter fails its own grader (spec §8.2)', () => {
  for (const challenge of autoGraded) {
    test(
      `${challenge.id} (starter)`,
      async () => {
        const report = await runGrade({ challenge, files: challenge.starter });
        expect(report.passed).toBe(false);
        const failures = report.assertions.filter((assertion) => !assertion.ok);
        // A grader that asserts nothing would "fail" only via the no-assertions guard; require a
        // real, hinted failure so starters teach from the first submit.
        const hinted = failures.filter((assertion) => assertion.hint.length > 0);
        expect(report.threw !== null || hinted.length > 0).toBe(true);
      },
      (challenge.graderTimeoutMs ?? DEFAULT_GRADER_TIMEOUT_MS) + 20_000,
    );
  }
});
