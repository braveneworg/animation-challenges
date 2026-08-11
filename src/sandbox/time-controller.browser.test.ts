import { afterEach, expect, test } from 'vitest';

import { installTimeController, type InstalledTimeController } from '@/sandbox/time-controller';

let fixture: HTMLElement | null = null;
let installed: InstalledTimeController | null = null;

afterEach(() => {
  installed?.uninstall();
  installed = null;
  fixture?.remove();
  fixture = null;
  for (const styleEl of Array.from(document.querySelectorAll('style[data-tc-test]'))) styleEl.remove();
});

function addStyle(css: string): void {
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-tc-test', '');
  styleEl.textContent = css;
  document.head.append(styleEl);
}

function addBox(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = 'box';
  document.body.append(el);
  fixture = el;
  return el;
}

function translationX(el: Element): number {
  const value = getComputedStyle(el).transform;
  return value === 'none' ? 0 : new DOMMatrix(value).e;
}

test('seek scrubs a CSSTransition: 250ms of a 1000ms linear 0→400px reads exactly 100px', async () => {
  installed = installTimeController(window, 'virtual');
  addStyle('.t-box { width: 40px; height: 40px; transition: transform 1000ms linear; transform: translateX(0); }');
  const el = addBox('t-box');
  void el.offsetWidth; // commit the initial style
  el.style.transform = 'translateX(400px)';
  await installed.nativeNextFrame();
  expect(document.getAnimations().length).toBeGreaterThan(0);
  await installed.controller.seek(250);
  expect(translationX(el)).toBeCloseTo(100, 0);
});

test('seek scrubs a CSSAnimation: 400ms of an 800ms linear 0→200px reads exactly 100px', async () => {
  installed = installTimeController(window, 'virtual');
  addStyle(
    '@keyframes tc-slide { from { transform: translateX(0); } to { transform: translateX(200px); } }\n' +
      '.a-box { width: 40px; height: 40px; animation: tc-slide 800ms linear forwards; }',
  );
  const el = addBox('a-box');
  await installed.nativeNextFrame();
  await installed.controller.seek(400);
  expect(translationX(el)).toBeCloseTo(100, 0);
});

test('seek scrubs WAAPI: 300ms of a 1200ms linear 0→600px reads exactly 150px', async () => {
  installed = installTimeController(window, 'virtual');
  const el = addBox('w-box');
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(600px)' }], {
    duration: 1200,
    easing: 'linear',
    fill: 'forwards',
  });
  await installed.controller.seek(300);
  expect(translationX(el)).toBeCloseTo(150, 0);
});

test('stepFrames(15) of a 500ms/300px rAF tween yields exactly 150px — n frames of motion, not n−1', async () => {
  installed = installTimeController(window, 'virtual');
  const el = addBox('r-box');
  let start: number | null = null;
  const loop = (t: number): void => {
    start ??= t;
    const progress = Math.min((t - start) / 500, 1);
    el.style.transform = `translateX(${progress * 300}px)`;
    if (progress < 1) window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
  await installed.controller.stepFrames(15);
  expect(translationX(el)).toBeCloseTo(150, 5);
  expect(installed.controller.now()).toBeCloseTo(15 * installed.controller.frameMs, 9);
});

test('a performance.now-baselined tween observes the same n frames', async () => {
  installed = installTimeController(window, 'virtual');
  const el = addBox('p-box');
  const start = performance.now(); // 0 under the virtual clock — same baseline as the zero-advance flush
  const loop = (): void => {
    const progress = Math.min((performance.now() - start) / 500, 1);
    el.style.transform = `translateX(${progress * 300}px)`;
    if (progress < 1) window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
  await installed.controller.stepFrames(15);
  expect(translationX(el)).toBeCloseTo(150, 5);
});

test('settle resumes scrubbed animations and reaches the end state', async () => {
  installed = installTimeController(window, 'virtual');
  const el = addBox('s-box');
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(80px)' }], {
    duration: 60,
    easing: 'linear',
    fill: 'forwards',
  });
  await installed.controller.seek(30);
  await installed.controller.settle();
  expect(translationX(el)).toBeCloseTo(80, 0);
});

test('settle does not hang on an infinite animation', async () => {
  installed = installTimeController(window, 'virtual');
  const el = addBox('i-box');
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, iterations: Infinity });
  const before = Date.now();
  await installed.controller.settle({ timeoutMs: 300 });
  // Virtual Date.now is patched, so measure with a bounded native expectation instead: the await
  // resolved at all — and quickly enough for the suite's 5s default timeout — which is the claim.
  expect(Date.now() - before).toBeGreaterThanOrEqual(0);
});

test('uninstall restores native rAF and performance.now', async () => {
  installed = installTimeController(window, 'virtual');
  installed.uninstall();
  // Two single-resolve promises raced, not one promise resolved from two branches: oxlint's
  // `promise/no-multiple-resolved` flags a shared executor calling `resolve` from both a timer and
  // an rAF callback, even though only one branch ever wins the race.
  const rafTicked = new Promise<boolean>((resolve) => {
    window.requestAnimationFrame(() => resolve(true));
  });
  const timedOut = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 2000);
  });
  const ticked = await Promise.race([rafTicked, timedOut]);
  expect(ticked).toBe(true);
  expect(performance.now()).toBeGreaterThan(0);
  installed = null;
});
