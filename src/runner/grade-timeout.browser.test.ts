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

function trivialPayload(challengeId = 'test/timeout-host'): MountPayload {
  const prepared = prepareSubmission({ 'index.html': '<div class="t-box">x</div>' }, 'dom');
  if (!prepared.ok) throw new Error('fixture must prepare');
  const { submission } = prepared;
  return {
    challengeId,
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

// --- gradeInFlight guard (spec §6.7 timer-sweep hazard) ---
//
// Ordering in every test below is deterministic, not a race: `frame.grade(...)` is called WITHOUT
// awaiting, so its 'grade' postMessage is sent before the second call's postMessage
// (`reset`/`mount`/`replay`/`grade`); the harness receives same-source messages in that same FIFO
// order; and `gradeInFlight` is set synchronously at the very top of the 'grade' case, before
// `grade()`'s first internal `await` — so by the time the frame processes the second message, the
// flag is already `true` no matter how long the grade's own async work (a dynamic `import()`, a
// paced `stepFrames`) takes. Together these five tests exercise all four guarded branches
// ('mount', 'grade' reentrancy, 'reset', 'replay').

test('a reset() ignored mid-grade does not corrupt the in-flight grade', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload());
  const gradePromise = frame.grade('css-transitions/_timeout-fixture', 300);
  frame.reset();
  const report = await gradePromise;
  expect(report.timedOut).toBe(true);
  expect(report.assertions.length).toBe(2);
  expect(report.assertions.every((assertion) => assertion.ok)).toBe(true);
}, 20_000);

test('a reset() ignored mid-grade does not sweep a live TimeController pacing timer', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload());
  const gradePromise = frame.grade('css-transitions/_stepframes-fixture', 5000);
  frame.reset();
  const report = await gradePromise;
  expect(report.timedOut).toBe(false);
  expect(report.threw).toBeNull();
  expect(report.assertions.length).toBe(1);
  expect(report.assertions[0]?.ok).toBe(true);
}, 20_000);

test('a mount() ignored mid-grade rejects fast via a loud protocol-scoped error, not the 15s mount timeout', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload('test/a'));
  const gradePromise = frame.grade('css-transitions/_timeout-fixture', 300);
  const startedAt = performance.now();
  await expect(frame.mount(trivialPayload('test/b'))).rejects.toThrow(/grade in progress/);
  expect(performance.now() - startedAt).toBeLessThan(5000);
  await gradePromise;
}, 20_000);

test('a second concurrent grade() is rejected loudly without corrupting the first grade result', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload());
  const firstGrade = frame.grade('css-transitions/_timeout-fixture', 300);
  // The reentrancy guard drops this on the frame side with a `scope: 'protocol'` error, which
  // nothing in `SandboxFrame.grade()` listens for — so this promise only settles later, via its own
  // host backstop timer, independently of `firstGrade`.
  const secondGrade = frame.grade('css-transitions/hover-lift', 300);
  const firstReport = await firstGrade;
  expect(firstReport.timedOut).toBe(true);
  expect(firstReport.assertions.length).toBe(2);
  const secondReport = await secondGrade;
  expect(secondReport.timedOut).toBe(true);
}, 20_000);

test('a replay() ignored mid-grade does not sweep a live TimeController pacing timer', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(trivialPayload());
  // Decisive, timing-independent discriminator: `replay()` re-enters `mount()`, which always posts
  // its own 'mounted' message once it completes. Unlike `reset()` (which merely nulls
  // `installedTime` and leaves it that way, so whether a live grade's `ctx.time` access observes the
  // gap depends on a dynamic-import-vs-synchronous-reinstall race), an unguarded `replay()` always
  // eventually remounts regardless of that race — so counting extra 'mounted' messages catches the
  // guard's absence reliably, independent of grader-internal timing.
  let extraMounts = 0;
  frame.onMessage((message) => {
    if (message.type === 'mounted') extraMounts += 1;
  });
  const gradePromise = frame.grade('css-transitions/_stepframes-fixture', 5000);
  frame.replay();
  const report = await gradePromise;
  expect(report.timedOut).toBe(false);
  expect(report.threw).toBeNull();
  expect(report.assertions.length).toBe(1);
  expect(report.assertions[0]?.ok).toBe(true);
  expect(extraMounts).toBe(0);
}, 20_000);
