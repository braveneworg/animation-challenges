import { afterEach, expect, test } from 'vitest';

import {
  applyForcedMediaToStyles,
  enableSimulatedHover,
  patchMatchMedia,
  SIMULATED_HOVER_CLASS,
} from '@/sandbox/environment';

let restoreMatchMedia: (() => void) | null = null;
const fixtures: HTMLElement[] = [];

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  for (const el of fixtures.splice(0)) el.remove();
  for (const styleEl of Array.from(document.querySelectorAll('style[data-env-test]'))) styleEl.remove();
});

function addStyle(css: string): void {
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-env-test', '');
  styleEl.textContent = css;
  document.head.append(styleEl);
}

function addBox(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  document.body.append(el);
  fixtures.push(el);
  return el;
}

test('patchMatchMedia forces both reduced-motion query polarities and leaves other queries alone', () => {
  restoreMatchMedia = patchMatchMedia(window, true);
  expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
  expect(window.matchMedia('(prefers-reduced-motion: no-preference)').matches).toBe(false);
  expect(window.matchMedia('(min-width: 1px)').matches).toBe(true);
  restoreMatchMedia();
  restoreMatchMedia = patchMatchMedia(window, false);
  expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
  expect(window.matchMedia('(prefers-reduced-motion: no-preference)').matches).toBe(true);
});

test('applyForcedMediaToStyles enables reduce blocks and disables no-preference blocks when forced on', () => {
  addStyle(
    '.env-box { transition-duration: 500ms; }\n' +
      '@media (prefers-reduced-motion: reduce) { .env-box { transition-duration: 1ms; } }\n' +
      '@media (prefers-reduced-motion: no-preference) { .env-box { opacity: 0.5; } }',
  );
  const el = addBox('env-box');
  applyForcedMediaToStyles(document, true);
  expect(getComputedStyle(el).transitionDuration).toBe('0.001s');
  expect(getComputedStyle(el).opacity).toBe('1');
});

test('applyForcedMediaToStyles inverts when forced off', () => {
  addStyle(
    '@media (prefers-reduced-motion: reduce) { .env-box2 { opacity: 0.25; } }\n' +
      '@media (prefers-reduced-motion: no-preference) { .env-box2 { opacity: 0.75; } }',
  );
  const el = addBox('env-box2');
  applyForcedMediaToStyles(document, false);
  expect(getComputedStyle(el).opacity).toBe('0.75');
});

test('enableSimulatedHover rewrites :hover in place — lists, :not(:hover), and comma-bearing :is() all survive', () => {
  addStyle(
    '.hov-box:hover, .hov-other { transform: translateY(-4px); }\n' +
      '.hov-box { opacity: 1; }\n' +
      '.hov-box:not(:hover) { opacity: 0.25; }\n' +
      ':is(.hov-a:hover, .hov-b) { color: rgb(0, 128, 0); }',
  );
  const el = addBox('hov-box');
  const isEl = addBox('hov-a');
  enableSimulatedHover(document);

  // Un-hovered: the :hover rule must not apply, the :not(:hover) rule MUST.
  expect(getComputedStyle(el).transform).toBe('none');
  expect(getComputedStyle(el).opacity).toBe('0.25');

  el.classList.add(SIMULATED_HOVER_CLASS);
  const matrix = new DOMMatrix(getComputedStyle(el).transform);
  expect(matrix.f).toBeCloseTo(-4, 1);
  // The rewrite must ALSO defeat the negation: :not(:is(:hover, .__ac-hover)) no longer matches.
  expect(getComputedStyle(el).opacity).toBe('1');

  // A comma inside :is() must not be treated as a selector-list separator — the rewritten rule
  // stays valid and the marker still triggers it.
  isEl.classList.add(SIMULATED_HOVER_CLASS);
  expect(getComputedStyle(isEl).color).toBe('rgb(0, 128, 0)');
});

test('enableSimulatedHover is idempotent — a second run leaves already-rewritten rules alone', () => {
  addStyle('.hov-twice:hover { transform: translateY(-2px); }');
  const el = addBox('hov-twice');
  enableSimulatedHover(document);
  enableSimulatedHover(document);
  el.classList.add(SIMULATED_HOVER_CLASS);
  expect(new DOMMatrix(getComputedStyle(el).transform).f).toBeCloseTo(-2, 1);
});
