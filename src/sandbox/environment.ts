/** Class the DSL toggles to simulate hover; `enableSimulatedHover` rewrites `:hover` selectors to also match it. */
export const SIMULATED_HOVER_CLASS = '__ac-hover';

/**
 * Forces the JS-visible `prefers-reduced-motion` value (spec §6.3). Queries mentioning the feature
 * are answered by delegating to a statically-true/false query (`all` / `not all`), which yields a
 * REAL MediaQueryList — correct `matches`, working (never-firing) listeners. Other queries pass
 * through untouched. Returns the restore function.
 *
 * CAVEAT (binding for challenge authors): a COMPOUND query containing the feature — e.g.
 * `(min-width: 9999px) and (prefers-reduced-motion: reduce)` — is answered solely from the
 * reduced-motion clause; the other conditions are ignored. Challenges must read the feature with a
 * standalone `matchMedia('(prefers-reduced-motion: reduce)')` query, never a compound one.
 */
export function patchMatchMedia(win: Window & typeof globalThis, forcedReducedMotion: boolean): () => void {
  const original = win.matchMedia.bind(win);
  win.matchMedia = (query: string): MediaQueryList => {
    if (!query.includes('prefers-reduced-motion')) return original(query);
    const asksForReduce = !query.includes('no-preference');
    const matches = asksForReduce ? forcedReducedMotion : !forcedReducedMotion;
    return original(matches ? 'all' : 'not all');
  };
  return (): void => {
    win.matchMedia = original;
  };
}

/**
 * Near-duplicate of `forEachSheetRule` in `src/sandbox/grade-context.ts` — deliberately not
 * shared. This walker only needs to reach `@media`/other grouping rules to flip reduced-motion
 * blocks and rewrite `:hover` selectors; it never needs to see the individual keyframe steps
 * inside a `@keyframes` block, so it does not descend into `CSSKeyframesRule` children the way
 * grade-context's walker does for grading assertions like `hasKeyframesRule`.
 */
function forEachRule(rules: CSSRuleList, visit: (rule: CSSRule) => void): void {
  for (const rule of Array.from(rules)) {
    visit(rule);
    if (rule instanceof CSSGroupingRule) forEachRule(rule.cssRules, visit);
  }
}

/**
 * CSS cannot be lied to through matchMedia, so `@media (prefers-reduced-motion: …)` blocks are
 * flipped directly: blocks whose condition should hold get `mediaText = 'all'`, the others
 * `'not all'`. Safe to re-run: a rule it already flipped no longer carries the condition text it
 * detects by and is skipped (staying flipped), while rules regenerated since the last run — the
 * Tailwind JIT rewrites its output sheet on recompile — get flipped fresh. The harness runs it at
 * mount and again after each Tailwind compile wait.
 */
export function applyForcedMediaToStyles(doc: Document, forcedReducedMotion: boolean): void {
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // inaccessible sheet (should not happen same-origin; skip rather than abort)
    }
    forEachRule(rules, (rule) => {
      if (!(rule instanceof CSSMediaRule)) return;
      if (!rule.conditionText.includes('prefers-reduced-motion')) return;
      const asksForReduce = !rule.conditionText.includes('no-preference');
      const shouldApply = asksForReduce ? forcedReducedMotion : !forcedReducedMotion;
      rule.media.mediaText = shouldApply ? 'all' : 'not all';
    });
  }
}

/**
 * Real `:hover` cannot be forced from JavaScript, so every `:hover` is rewritten IN PLACE to
 * `:is(:hover, .__ac-hover)` (spec §6.5's `hover` interaction). In place, not an appended variant:
 * real hover never happens in the grading frame, so an untouched `.card:not(:hover)` would match
 * permanently and could never be "un-hovered" — the in-place rewrite gives
 * `:not(:is(:hover, .__ac-hover))` the correct negation semantics. A whole-`selectorText`
 * `replaceAll` also survives comma-bearing functional pseudo-classes like `:is(.a:hover, .b)`,
 * which naive comma-splitting corrupts (Chromium silently ignores an invalid `selectorText`
 * assignment). Specificity is unchanged: `:is()` takes the max of its arguments, and a class
 * equals a pseudo-class. Idempotent — rules already carrying the marker are skipped, so the
 * harness may re-run this after a Tailwind JIT recompile regenerates its output sheet.
 */
export function enableSimulatedHover(doc: Document): void {
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    forEachRule(rules, (rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      if (!rule.selectorText.includes(':hover')) return;
      if (rule.selectorText.includes(SIMULATED_HOVER_CLASS)) return;
      rule.selectorText = rule.selectorText.replaceAll(':hover', `:is(:hover, .${SIMULATED_HOVER_CLASS})`);
    });
  }
}
