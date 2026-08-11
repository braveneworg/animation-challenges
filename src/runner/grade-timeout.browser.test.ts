import { afterEach, expect, test } from 'vitest';

import { challenge as hoverLift } from '@/challenges/css-transitions/hover-lift';
import { prepareSubmission } from '@/runner/pipeline';
import type { MountPayload } from '@/runner/protocol';
import { runGrade } from '@/runner/run-grade';
import { SandboxFrame } from '@/runner/sandbox-frame';

let frame: SandboxFrame | null = null;

afterEach(() => {
  frame?.destroy();
  frame = null;
});

function trivialPayload(): MountPayload {
  const prepared = prepareSubmission({ 'index.html': '<div class="t-box">x</div>' }, 'dom');
  if (!prepared.ok) throw new Error('fixture must prepare');
  const { submission } = prepared;
  return {
    challengeId: 'test/timeout-host',
    runtime: 'dom',
    wantsTailwind: false,
    modules: submission.modules,
    cssFiles: submission.cssFiles,
    htmlFile: submission.htmlFile,
    entryPath: submission.entryPath,
    sources: submission.sources,
  };
}

test('the frame-side timeout reports timedOut: true WITH the partial assertions already recorded (spec §6.7)', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload());
  const report = await frame.grade('css-transitions/_timeout-fixture', 300);
  expect(report.timedOut).toBe(true);
  expect(report.passed).toBe(false);
  expect(report.assertions.length).toBe(2);
  expect(report.assertions.every((assertion) => assertion.ok)).toBe(true);
  // The frame answered on its own; it stays usable.
  expect(frame.isAlive).toBe(true);
}, 20_000);

test('a frame that stops responding hits the host backstop at timeoutMs + 2000 and is marked dead', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload());
  // Simulate a dead frame: navigate it away so the harness and its message listener are gone.
  const iframe = Array.from(document.querySelectorAll('iframe')).at(-1);
  iframe?.contentWindow?.location.replace('about:blank');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const report = await frame.grade('css-transitions/hover-lift', 200);
  expect(report.timedOut).toBe(true);
  expect(report.assertions).toEqual([]);
  expect(report.threw?.message).toContain('stopped responding');
  expect(frame.isAlive).toBe(false);
}, 20_000);

test('a submission with an infinite loop is caught by the injected guard end to end', async () => {
  const report = await runGrade({
    challenge: hoverLift,
    files: { ...hoverLift.solution, 'index.ts': 'for (;;) {\n  void 0;\n}\n' },
  });
  expect(report.passed).toBe(false);
  expect(report.threw?.message).toContain('possible infinite loop');
}, 30_000);
