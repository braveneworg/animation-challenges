import { afterEach, expect, test } from 'vitest';

import type { RuntimeKind } from '@/challenges/types';
import { prepareSubmission } from '@/runner/pipeline';
import type { MountPayload } from '@/runner/protocol';
import { SandboxFrame } from '@/runner/sandbox-frame';

let frame: SandboxFrame | null = null;

afterEach(() => {
  frame?.destroy();
  frame = null;
});

function payloadFor(files: Readonly<Record<string, string>>, runtime: RuntimeKind): MountPayload {
  const prepared = prepareSubmission(files, runtime);
  if (!prepared.ok) throw new Error(prepared.diagnostics.map((d) => d.message).join('; '));
  const { submission } = prepared;
  return {
    challengeId: 'test/fixture',
    runtime,
    wantsTailwind: false,
    modules: submission.modules,
    cssFiles: submission.cssFiles,
    htmlFile: submission.htmlFile,
    entryPath: submission.entryPath,
    sources: submission.sources,
  };
}

function frameDocument(): Document {
  // The frame is same-origin by design (spec §6.7), so tests may reach inside it. SandboxFrame owns
  // exactly one iframe per instance and afterEach destroys it, so the last iframe is the live one.
  const iframe = Array.from(document.querySelectorAll('iframe')).at(-1);
  const doc = iframe?.contentDocument;
  if (!doc) throw new Error('sandbox frame document unreachable');
  return doc;
}

function waitForNextMounted(target: SandboxFrame): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('replay never remounted')), 10_000);
    const unsubscribe = target.onMessage((message) => {
      if (message.type === 'mounted') {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

const DOM_FIXTURE = {
  'index.html': '<div class="fx-card">card</div>',
  'styles.css': '.fx-card { width: 100px; }',
  'index.ts': [
    "import { tag } from './helper';",
    "import { version } from 'react';",
    "console.log('fixture-log', tag, version.slice(0, 2));",
    "const card = document.querySelector('.fx-card');",
    "if (card) card.setAttribute('data-tagged', tag);",
    '',
  ].join('\n'),
  'helper.ts': "export const tag = 'ok';\n",
};

test('mounts a dom submission: html injected, css applied, entry ran through the blob graph and import map', async () => {
  frame = await SandboxFrame.create();
  const consoleTexts: string[] = [];
  frame.onMessage((message) => {
    if (message.type === 'console') consoleTexts.push(message.text);
  });
  await frame.mount(payloadFor(DOM_FIXTURE, 'dom'));
  const doc = frameDocument();
  // A plain null check, not `instanceof HTMLElement`: `card` belongs to the iframe's own realm,
  // whose `HTMLElement` constructor is distinct from this top-level test window's (spec §6.7's
  // same-origin access does not merge globals) — `instanceof` against the wrong realm's
  // constructor is always false even for a genuine element, per the precedent already set by
  // `sandbox-entry.browser.test.ts`, which null-checks rather than `instanceof`-checks.
  const card = doc.querySelector('.fx-card');
  if (card === null) throw new Error('fixture card missing');
  expect(card.getAttribute('data-tagged')).toBe('ok');
  expect(getComputedStyle(card).width).toBe('100px');
  expect(consoleTexts.some((text) => text.includes('fixture-log ok 19'))).toBe(true);
});

test('mounts a react submission through App.tsx', async () => {
  frame = await SandboxFrame.create();
  await frame.mount(
    payloadFor(
      {
        'App.tsx': 'export default function App() {\n  return <p className="from-react">rendered</p>;\n}\n',
      },
      'react',
    ),
  );
  const doc = frameDocument();
  expect(doc.querySelector('#stage .from-react')?.textContent).toBe('rendered');
});

test('a throwing entry rejects the mount with the error message', async () => {
  frame = await SandboxFrame.create();
  await expect(frame.mount(payloadFor({ 'index.ts': "throw new Error('mount boom');\n" }, 'module'))).rejects.toThrow(
    /mount boom/,
  );
});

test('replay remounts the last payload', async () => {
  const current = await SandboxFrame.create();
  frame = current;
  const consoleTexts: string[] = [];
  const mountedCount = { value: 0 };
  current.onMessage((message) => {
    if (message.type === 'console') consoleTexts.push(message.text);
    if (message.type === 'mounted') mountedCount.value += 1;
  });
  await current.mount(payloadFor(DOM_FIXTURE, 'dom'));
  const remounted = waitForNextMounted(current);
  current.replay();
  await remounted;
  expect(mountedCount.value).toBe(2);
  expect(consoleTexts.filter((text) => text.includes('fixture-log')).length).toBe(2);
});

test('setEnvironment resizes the frame and forces reduced motion before mount', async () => {
  frame = await SandboxFrame.create({
    environment: { forcedReducedMotion: true, clock: 'virtual', viewport: { width: 512, height: 384 } },
  });
  const consoleTexts: string[] = [];
  frame.onMessage((message) => {
    if (message.type === 'console') consoleTexts.push(message.text);
  });
  await frame.mount(
    payloadFor(
      { 'index.ts': "console.log('rm', window.matchMedia('(prefers-reduced-motion: reduce)').matches);\n" },
      'module',
    ),
  );
  const iframe = Array.from(document.querySelectorAll('iframe')).at(-1);
  expect(iframe?.style.width).toBe('512px');
  expect(consoleTexts.some((text) => text.includes('rm true'))).toBe(true);
});

test('a frame that never handshakes is torn down, retried once, then rejected', async () => {
  await expect(SandboxFrame.create({ sandboxUrl: '/no-such-sandbox.html', readyTimeoutMs: 700 })).rejects.toThrow(
    /ready/,
  );
  expect(document.querySelectorAll('iframe').length).toBe(0);
}, 15_000);

// --- Reviewer-flagged behaviours (not in the plan's literal six tests; added to pin them) ---

// Behaviour 1: every mount injects FRESH <style> elements from the submission's source text.
// `applyForcedMediaToStyles` flips a live CSSMediaRule's `mediaText` to 'all'/'not all', which
// erases the `prefers-reduced-motion` condition text it detects by — a rule already flipped once
// can never be flipped back. Only re-injecting the ORIGINAL source into a brand-new <style> gives
// the next mount's flip a rule that still carries the condition. This test forces reduced motion
// on, mounts (observing the "reduce" branch), then changes the environment to off and replays,
// requiring the "no-preference" branch to take effect — impossible without fresh styles per mount.
const REDUCED_MOTION_FIXTURE = {
  'index.html': '<div class="fx-motion">motion</div>',
  'styles.css': [
    '.fx-motion { color: rgb(255, 0, 0); }',
    '@media (prefers-reduced-motion: reduce) { .fx-motion { color: rgb(0, 0, 255); } }',
  ].join('\n'),
};

test('setEnvironment change + replay re-flips a reduced-motion media rule via fresh style injection', async () => {
  const current = await SandboxFrame.create({
    environment: { forcedReducedMotion: true, clock: 'virtual', viewport: { width: 800, height: 600 } },
  });
  frame = current;
  await current.mount(payloadFor(REDUCED_MOTION_FIXTURE, 'dom'));
  const doc = frameDocument();
  // Plain null checks, not `instanceof HTMLElement` — see the comment on the dom-submission test
  // above: these elements belong to the iframe's own realm, not this window's.
  const before = doc.querySelector('.fx-motion');
  if (before === null) throw new Error('fixture missing before replay');
  expect(getComputedStyle(before).color).toBe('rgb(0, 0, 255)');

  current.setEnvironment({ forcedReducedMotion: false, clock: 'virtual', viewport: { width: 800, height: 600 } });
  const remounted = waitForNextMounted(current);
  current.replay();
  await remounted;
  const after = doc.querySelector('.fx-motion');
  if (after === null) throw new Error('fixture missing after replay');
  expect(getComputedStyle(after).color).toBe('rgb(255, 0, 0)');
});

// Behaviour 2a: a React component whose render throws must surface a visible `error` FrameMessage
// over the protocol and reject the mount — never a silent, blank `mounted` stage. The error
// boundary's `onError` fires synchronously during the mount, well before the harness's own
// `mounted` post two native frames later, so the host sees `error` first and rejects.
test('a react component that throws during render surfaces a protocol error, not a silent mount', async () => {
  frame = await SandboxFrame.create();
  await expect(
    frame.mount(
      payloadFor({ 'App.tsx': "export default function App() {\n  throw new Error('render boom');\n}\n" }, 'react'),
    ),
  ).rejects.toThrow(/render boom/);
});

// Behaviour 2b: a rejected (non-function-component) default export must also surface a visible
// protocol error rather than mounting a blank stage.
test('a react default export that is a class component rejects the mount with a visible error', async () => {
  frame = await SandboxFrame.create();
  await expect(
    frame.mount(
      payloadFor(
        {
          'App.tsx': [
            "import { Component } from 'react';",
            'export default class App extends Component {',
            '  render() {',
            '    return null;',
            '  }',
            '}',
            '',
          ].join('\n'),
        },
        'react',
      ),
    ),
  ).rejects.toThrow(/App\.tsx/);
});
