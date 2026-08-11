import { afterEach, expect, test } from 'vitest';

import { DEFAULT_ENVIRONMENT, type SandboxEnvironment } from '@/runner/protocol';
import { AssertionLog } from '@/sandbox/assertion-log';
import { enableSimulatedHover } from '@/sandbox/environment';
import { buildGradeContext, type GradeContext } from '@/sandbox/grade-context';
import { installTimeController, type InstalledTimeController } from '@/sandbox/time-controller';

let installed: InstalledTimeController | null = null;
let stage: HTMLElement | null = null;
let remounts: SandboxEnvironment[] = [];

afterEach(() => {
  installed?.uninstall();
  installed = null;
  stage?.remove();
  stage = null;
  remounts = [];
  for (const styleEl of Array.from(document.querySelectorAll('style[data-gc-test]'))) styleEl.remove();
});

function addStyle(css: string): void {
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-gc-test', '');
  styleEl.textContent = css;
  document.head.append(styleEl);
}

function makeContext(
  html: string,
  options?: { sources?: Record<string, string>; exports?: Record<string, unknown> },
): {
  ctx: GradeContext;
  log: AssertionLog;
} {
  const container = document.createElement('div');
  container.id = 'gc-stage';
  container.innerHTML = html;
  document.body.append(container);
  stage = container;
  const time = installTimeController(window, 'virtual');
  installed = time;
  const log = new AssertionLog();
  const ctx = buildGradeContext({
    win: window,
    doc: document,
    stage: container,
    time: () => time.controller,
    nativeNextFrame: () => time.nativeNextFrame(),
    moduleExports: () => options?.exports ?? {},
    sources: options?.sources ?? {},
    log,
    environment: () => DEFAULT_ENVIRONMENT,
    remount: (environment) => {
      remounts.push(environment);
      return Promise.resolve();
    },
  });
  return { ctx, log };
}

test('query, queryAll, computed, and matrix read the stage', () => {
  addStyle('.gc-a { transform: translateY(-8px); width: 50px; }');
  const { ctx } = makeContext('<div class="gc-a"></div><div class="gc-b"></div>');
  const el = ctx.query('.gc-a');
  if (el === null) throw new Error('query missed');
  expect(ctx.queryAll('div').length).toBe(2);
  expect(ctx.computed(el, 'width')).toBe('50px');
  expect(ctx.matrix(el).f).toBeCloseTo(-8, 1);
  const plain = ctx.query('.gc-b');
  if (plain === null) throw new Error('query missed .gc-b');
  expect(ctx.matrix(plain).f).toBe(0);
});

test('expect and expectClose accumulate without throwing', () => {
  const { ctx, log } = makeContext('<div></div>');
  expect(ctx.expect(false, { message: 'fails', hint: 'h', actual: 1, expected: 2 })).toBe(false);
  expect(ctx.expectClose(5, 5.4, 0.5, { message: 'close enough', hint: 'h' })).toBe(true);
  expect(ctx.expectClose(5, 6, 0.5, { message: 'too far', hint: 'h' })).toBe(false);
  expect(log.records.length).toBe(3);
  expect(log.allPassed).toBe(false);
  expect(log.records[1]?.expected).toBe('5.4 ± 0.5');
});

test('hover toggles rewritten :hover rules and styleAt scrubs a transition', async () => {
  addStyle(
    '.gc-h { transition: transform 400ms linear; transform: translateX(0); } .gc-h:hover { transform: translateX(100px); }',
  );
  enableSimulatedHover(document);
  const { ctx } = makeContext('<div class="gc-h"></div>');
  const el = ctx.query('.gc-h');
  if (el === null) throw new Error('query missed');
  await ctx.hover(el);
  const mid = await ctx.styleAt(el, 'transform', 200);
  expect(new DOMMatrix(mid).e).toBeCloseTo(50, 0);
  await ctx.unhover(el);
});

test('animations/keyframesOf/timingOf introspect WAAPI on a specific element', () => {
  const { ctx } = makeContext('<div class="gc-w"></div><div class="gc-x"></div>');
  const el = ctx.query('.gc-w');
  if (el === null) throw new Error('query missed');
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'linear' });
  const anims = ctx.animations(el);
  expect(anims.length).toBe(1);
  const first = anims[0];
  if (first === undefined) throw new Error('no animation');
  expect(ctx.timingOf(first).duration).toBe(500);
  expect(ctx.keyframesOf(first).length).toBeGreaterThanOrEqual(2);
  const other = ctx.query('.gc-x');
  if (other === null) throw new Error('query missed');
  expect(ctx.animations(other).length).toBe(0);
});

test('cssRules, hasKeyframesRule, and ruleFor introspect stylesheets', () => {
  addStyle('@keyframes gc-spin { from { rotate: 0deg; } to { rotate: 360deg; } }\n.gc-r { color: red; }');
  const { ctx } = makeContext('<div></div>');
  expect(ctx.hasKeyframesRule('gc-spin')).toBe(true);
  expect(ctx.hasKeyframesRule('gc-nope')).toBe(false);
  expect(ctx.ruleFor('.gc-r')?.style.color).toBe('red');
  expect(ctx.cssRules().length).toBeGreaterThan(0);
});

test('click and focus dispatch real interactions', async () => {
  const { ctx } = makeContext('<button class="gc-btn">go</button>');
  const el = ctx.query('.gc-btn');
  if (!(el instanceof HTMLElement)) throw new Error('query missed');
  let clicks = 0;
  el.addEventListener('click', () => {
    clicks += 1;
  });
  await ctx.click(el);
  await ctx.focus(el);
  expect(clicks).toBe(1);
  expect(document.activeElement).toBe(el);
});

test('click dispatches the full five-event mouse sequence in order', async () => {
  const { ctx } = makeContext('<button class="gc-order">go</button>');
  const el = ctx.query('.gc-order');
  if (!(el instanceof HTMLElement)) throw new Error('query missed');
  const order: string[] = [];
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.addEventListener(type, () => {
      order.push(type);
    });
  }
  await ctx.click(el);
  expect(order).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
});

test('source and moduleExports expose the submission; setReducedMotion remounts with a flipped flag', async () => {
  const { ctx } = makeContext('<div></div>', {
    sources: { 'index.ts': 'export const speed = 3;' },
    exports: { speed: 3 },
  });
  expect(ctx.source('index.ts')).toContain('speed');
  expect(() => ctx.source('missing.ts')).toThrow(/missing\.ts/);
  expect(ctx.moduleExports['speed']).toBe(3);
  await ctx.setReducedMotion(true);
  expect(remounts.length).toBe(1);
  expect(remounts[0]?.forcedReducedMotion).toBe(true);
});
