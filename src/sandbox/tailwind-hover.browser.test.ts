import { afterEach, expect, test } from 'vitest';

import { DEFAULT_ENVIRONMENT } from '@/runner/protocol';
import { AssertionLog } from '@/sandbox/assertion-log';
import { enableSimulatedHover, SIMULATED_HOVER_CLASS } from '@/sandbox/environment';
import { buildGradeContext } from '@/sandbox/grade-context';
import { loadTailwind, waitForTailwind } from '@/sandbox/tailwind-loader';
import { installTimeController, type InstalledTimeController } from '@/sandbox/time-controller';

let installed: InstalledTimeController | null = null;
let stage: HTMLElement | null = null;

afterEach(() => {
  installed?.uninstall();
  installed = null;
  stage?.remove();
  stage = null;
});

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Finds the compiled `hover:` utility rule for `utilityClass` (e.g. `'hover:opacity-0'`), however
 * deeply Tailwind nests it (`@layer utilities { @media (hover: hover) { ... } }`). Mirrors the
 * walker `enableSimulatedHover`/`buildGradeContext` use internally — deliberately not shared, same
 * rationale as their own near-duplicates: this one exists only to make the rewrite's survival
 * assertable from a test.
 */
function findCompiledHoverRule(utilityClass: string): CSSStyleRule | null {
  const escaped = `.${utilityClass.replaceAll(/[.:]/g, '\\$&')}`;
  let match: CSSStyleRule | null = null;
  const walk = (rule: CSSRule): void => {
    if (match !== null) return;
    if (rule instanceof CSSStyleRule && rule.selectorText.startsWith(escaped)) {
      match = rule;
      return;
    }
    if (rule instanceof CSSGroupingRule) {
      for (const child of Array.from(rule.cssRules)) walk(child);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) walk(rule);
  }
  return match;
}

// Regression pin for the bug fixed in grade-context.ts's `hover()`/`unhover()`: adding or removing
// the `.__ac-hover` marker class is itself a DOM mutation that @tailwindcss/browser's own
// MutationObserver reacts to. It rescans the document for utility candidates and — the FIRST time
// any given class string appears anywhere on the page — reassigns the compiled <style>'s
// `textContent` wholesale (see node_modules/@tailwindcss/browser/dist/index.global.js: a module-level
// `Set` dedupes candidates forever, so only a genuinely NEW class string triggers this; the exact
// same string reappearing later does not). That wholesale replace silently discards the harness's
// in-place `:hover` -> `:is(:hover, .__ac-hover)` selector rewrite before a grader ever gets to read
// the "hovered" computed style. Deterministic regardless of suite order: Vitest browser mode gives
// each test FILE a fresh document, and `SIMULATED_HOVER_CLASS` (`__ac-hover`) is therefore novel to
// THIS page the first (and, in this file, only) time it is added — confirmed empirically: the same
// class re-added or removed later in a page's lifetime no longer triggers the destructive rebuild,
// which is why this file exercises `ctx.hover()` exactly once rather than also probing `unhover()`
// the same way (it would prove nothing — dedup already blocks the rebuild by the time it runs).
test('ctx.hover keeps a Tailwind-compiled hover: rule rewritten across the recompile it triggers', async () => {
  await loadTailwind(document);

  const container = document.createElement('div');
  container.id = 'tw-hover-stage';
  document.body.append(container);
  stage = container;

  const el = document.createElement('div');
  el.className = 'tw-hover-probe hover:opacity-0';
  container.append(el);

  // Mirrors the harness's own ordering (src/sandbox/harness.ts `mount()`): wait for the compile pass
  // that covers this markup, THEN apply the hover-selector rewrite.
  await waitForTailwind(document, nextFrame);
  enableSimulatedHover(document);

  const restingRule = findCompiledHoverRule('hover:opacity-0');
  if (restingRule === null) throw new Error('tailwind did not compile the hover:opacity-0 utility');
  expect(restingRule.selectorText).toContain(`:is(:hover, .${SIMULATED_HOVER_CLASS})`);
  expect(getComputedStyle(el).opacity).toBe('1');

  const time = installTimeController(window, 'virtual');
  installed = time;
  const ctx = buildGradeContext({
    win: window,
    doc: document,
    stage: container,
    time: () => time.controller,
    nativeNextFrame: () => time.nativeNextFrame(),
    moduleExports: () => ({}),
    sources: {},
    log: new AssertionLog(),
    environment: () => DEFAULT_ENVIRONMENT,
    remount: () => Promise.resolve(),
  });

  // This is the mutation that triggers @tailwindcss/browser's destructive rebuild: adding
  // `.__ac-hover` to the DOM for the first time ever on this page.
  await ctx.hover(el);

  const hoveredRule = findCompiledHoverRule('hover:opacity-0');
  if (hoveredRule === null) throw new Error('the hover:opacity-0 rule vanished after ctx.hover');
  expect(hoveredRule.selectorText).toContain(`:is(:hover, .${SIMULATED_HOVER_CLASS})`);
  expect(getComputedStyle(el).opacity).toBe('0');
}, 15_000);
