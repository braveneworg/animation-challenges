import { expect, test } from 'vitest';

import { challenge as hoverLift } from '@/challenges/css-transitions/hover-lift';
import { runGrade } from '@/runner/run-grade';

test('the hover-lift reference solution passes its own grader end to end', async () => {
  const report = await runGrade({ challenge: hoverLift, files: hoverLift.solution });
  expect(report.assertions.filter((assertion) => !assertion.ok)).toEqual([]);
  expect(report.threw).toBeNull();
  expect(report.timedOut).toBe(false);
  expect(report.assertions.length).toBeGreaterThanOrEqual(8);
  expect(report.passed).toBe(true);
}, 30_000);

test('the hover-lift starter fails, and every failing assertion teaches', async () => {
  const report = await runGrade({ challenge: hoverLift, files: hoverLift.starter });
  expect(report.passed).toBe(false);
  const failures = report.assertions.filter((assertion) => !assertion.ok);
  expect(failures.length).toBeGreaterThan(0);
  for (const failure of failures) expect(failure.hint.length).toBeGreaterThan(10);
}, 30_000);

test('a submission that does not transpile becomes a failed report, never a throw', async () => {
  const report = await runGrade({
    challenge: hoverLift,
    files: { ...hoverLift.solution, 'broken.ts': 'const x: = 1;\n' },
  });
  expect(report.passed).toBe(false);
  expect(report.threw?.message).toContain('did not transpile');
}, 30_000);

test('a failed sandbox handshake also becomes a failed report — runGrade never rejects', async () => {
  const report = await runGrade({
    challenge: hoverLift,
    files: hoverLift.solution,
    sandboxUrl: '/no-such-sandbox.html',
  });
  expect(report.passed).toBe(false);
  expect(report.threw?.message).toContain('ready');
}, 30_000);
