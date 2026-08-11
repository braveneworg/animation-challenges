import { afterEach, expect, test } from 'vitest';

import { loadTailwind, waitForTailwind } from '@/sandbox/tailwind-loader';

const fixtures: HTMLElement[] = [];

afterEach(() => {
  for (const el of fixtures.splice(0)) el.remove();
});

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function addUtilityBox(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  document.body.append(el);
  fixtures.push(el);
  return el;
}

// tailwindcss@4.3.3 (pinned in this repo) compiles `translate-y-[…]` to the standalone CSS
// `translate` property (`translate: var(--tw-translate-x) var(--tw-translate-y)`), not the
// composite `transform` property — Chromium's `getComputedStyle(el).transform` reports "none"
// regardless of `translate`, `rotate`, or `scale` (it reflects only the `transform` property
// itself, confirmed against a plain `el.style.translate` assignment with no Tailwind involved).
// Reading the `translate` property directly is the pinned-version-correct probe for this utility.
function translateY(el: Element): number {
  const [, y] = getComputedStyle(el).translate.split(' ');
  return Number.parseFloat(y ?? '0');
}

test('classes injected AFTER the library loads compile once waitForTailwind returns', async () => {
  await loadTailwind(document);
  // Injection after load, wait after injection — the harness's exact ordering.
  const el = addUtilityBox('translate-y-[-6px]');
  await waitForTailwind(document, nextFrame);
  expect(translateY(el)).toBeCloseTo(-6, 1);
}, 15_000);

test('a SECOND wait covers classes injected after the first — each call proves a fresh compile pass', async () => {
  await loadTailwind(document);
  await waitForTailwind(document, nextFrame);
  const late = addUtilityBox('translate-y-[-3px]');
  await waitForTailwind(document, nextFrame);
  expect(translateY(late)).toBeCloseTo(-3, 1);
}, 15_000);

// The behavioral tests above prove uniqueness only indirectly, by racing a real Tailwind compile —
// the mutation check for a reintroduced-recycled-probe bug showed the second-wait test can still
// pass by coincidence (a background compile pass beats the assertion to the punch), so it is not a
// reliable regression guard on its own. This test pins the MECHANISM directly and deterministically:
// observe the actual probe elements `waitForTailwind` inserts across two sequential calls and
// assert their class names differ, with no dependency on the Tailwind compiler's timing at all.
test('waitForTailwind inserts a probe with a fresh, distinct class name on each call', async () => {
  await loadTailwind(document);
  const probeClassNames: string[] = [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && node.hasAttribute('data-ac-tw-probe')) {
          probeClassNames.push(node.className);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true });
  await waitForTailwind(document, nextFrame);
  await waitForTailwind(document, nextFrame);
  observer.disconnect();
  expect(probeClassNames).toHaveLength(2);
  expect(new Set(probeClassNames).size).toBe(2);
}, 15_000);
