# Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author sixteen complete challenges — module plus grader — spanning every runtime, every grade mode, and every major content family, proving the whole platform end to end before mass content production (spec §11 step 4: "a flaw found there costs 16 rewrites instead of 123").

**Architecture:** Each challenge is one typed module (`src/challenges/<category>/<slug>.ts`) the registry glob collects automatically, plus — for `auto`/`hybrid` modes — a sibling `<slug>.grade.ts` the sandbox glob collects. Nothing else is wired by hand: `pnpm test:catalog` (Plan 02 Task 14) mechanically enforces that every solution passes its grader and every starter fails it. This plan also closes the Plan 01 carried-forward item it owns: series-membership rules in `checkCatalogIntegrity`, landed first because they gate the content that follows.

**Tech Stack:** React 19.2.8 · TypeScript 7.0.2 · Vite 8.2.1 · Vitest 4.1.10 (+ browser/Playwright) · Tailwind CSS 4.3.3 (+ `@tailwindcss/browser@4.3.3` in the sandbox) · `motion@13.0.0` (sandbox vendor module) · Zod 4.4.3 · oxlint 1.77.0 · Prettier 3.9.6 · pnpm 11.21.0 · Node 24.18.0. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-09-animation-challenges-design.md` (§2 tiered grading, §4 challenge model, §4.1 manifest, §4.2 series, §8.2 catalog suite, §11 sequencing)

**Runs after:** Plan 02 (`docs/superpowers/plans/2026-08-10-02-runner.md`). Its `## Contract for later plans` section is fact here: the grader convention, `GradeContext`, `TimeController`, `runGrade`, and the `pnpm test:catalog` gate all exist before this plan's first task.

## Global Constraints

- **No `any` type.** Enforced by `typescript/no-explicit-any` in oxlint.
- **No lint disable comments** in any spelling. Enforced by `pnpm lint:no-disable`.
- **No `as` type assertions on values you do not control** (`typescript/no-unsafe-type-assertion`). Narrow `unknown` with `typeof` / `in` / `instanceof` checks.
- **No `await` inside loop syntax** — `eslint(no-await-in-loop)` is an error via the perf category (verified against this repo's oxlint 1.77.0 on 2026-08-10). Sequential async stepping uses the recursive `forEachStep` from `@/sandbox/sequence` (Plan 02, as amended), re-exported for graders by Task 2.
- **Optional interface properties are `prop?: T | undefined`** (`exactOptionalPropertyTypes`).
- **Prettier:** printWidth 120, single quotes, trailing commas, semicolons, sorted imports. Run `pnpm format` before every commit.
- **Commits:** Conventional Commits, atomic, on branch `feat/animation-challenges-platform`. Never commit to `main`. No AI attribution or `Co-authored-by` lines. `pnpm verify` green before every commit — and `verify` now includes `pnpm test:catalog`.
- **TDD:** for the integrity rules and grader utilities, failing test first. For content, the failing state is observed through the catalog gate itself: land the challenge module, watch `pnpm test:catalog` fail on the grader-file rule, then land the grader and watch rules 5/6 go green.
- **`goals` are grader inputs, not prose.** Every goal must be literally true of the reference solution, and for every `auto`/`hybrid` challenge every auto-checkable goal maps to at least one grader assertion. Each challenge task carries an explicit goal→assertion map; the implementer verifies it against the code before committing.
- **Starters must genuinely fail their grader** (spec §8.2 rule 6) with at least one hinted failing assertion or a throw.
- **`stepFrames(n)` yields exactly n frames of motion** (Plan 02 compensates the baseline internally). All rAF arithmetic in this plan is written against n frames — never the old prototype's n − 1.
- **Never string-compare a computed `transform`.** Use `ctx.matrix(el)` (a `DOMMatrix`) and compare components with an epsilon. The same discipline extends to WAAPI keyframe values: assert observable computed state at seeked times, not authored keyframe strings.
- **No grader reads a compound media query.** Plan 02's `patchMatchMedia` answers only the `prefers-reduced-motion` clause (documented caveat). Challenge CSS and grader code use single-clause `(prefers-reduced-motion: …)` queries only.
- **`relatedIds` reference only challenges that exist at commit time.** The static integrity suite runs on every commit; a forward reference fails it. Members of one series land in a single task so they may reference each other.
- **All commands run from the repo root via relative paths.** The repo is public: no personal absolute paths, nothing secret-shaped, in any file.

---

## How rules 5/6 treat the three grade modes (binding interpretation)

Plan 02's contract prose says the catalog suite enforces rules 5 and 6 "for every registry challenge", but its test code (Task 14 Step 3) iterates rules 5/6 over `challenges.filter((c) => c.gradeMode !== 'rubric')` and enforces `gradeMode 'auto' | 'hybrid'` ⇔ grader file exists, `'rubric'` ⇔ no grader file. **The code is authoritative.** Consequences this plan is written against:

1. **`auto`** — grader required; solution must pass it; starter must fail it.
2. **`hybrid`** — exactly the same mechanical treatment as `auto`. The grader covers the auto-checkable portion of the goals, and that portion alone must discriminate: the starter must fail the *assertions*, not merely the rubric. The rubric covers what only a human can judge.
3. **`rubric`** — no grader file may exist. Rule 3 (both file sets transpile) and the static rules (distinct starter/solution, non-empty rubric) still apply.

## The sixteen challenges — coverage table

| # | id | §4.1 item | runtime | gradeMode | tech | difficulty | series | task |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `css-keyframes/bounce-in` | css-keyframes 2 | dom | auto | css | novice | bounce-in | 3 |
| 2 | `waapi/bounce-in` | waapi 2 | dom | auto | waapi, ts | intermediate | bounce-in | 3 |
| 3 | `motion-react-basics/bounce-in-spring` | motion-react-basics 2 | react | **hybrid** | react, motion | novice | bounce-in | 3 |
| 4 | `easing-math/lerp` | easing-math 1 | **module** | auto | ts | novice | — | 4 |
| 5 | `spring-physics/spring-step` | spring-physics 2 | **module** | auto | ts | intermediate | spring-settle | 4 |
| 6 | `tailwind-basics/hover-transition` | tailwind-basics 1 | dom | auto | tailwind, css | novice | — | 5 |
| 7 | `tailwind-custom/theme-pulse` | tailwind-custom 1 | dom | auto | tailwind, css | intermediate | — | 5 |
| 8 | `raf-tweening/first-loop` | raf-tweening 1 | dom | auto | ts | novice | — | 6 |
| 9 | `motion-core/first-animate` | motion-core 1 | dom | auto | motion, ts | novice | — | 6 |
| 10 | `easing-timing/overshoot-bezier` | easing-timing 5 | dom | auto | css | intermediate | — | 7 |
| 11 | `easing-timing/snappy-ease` | easing-timing 1 | dom | **rubric** | css | novice | — | 7 |
| 12 | `transforms-3d/card-flip` | transforms-3d 1 | dom | auto | css | novice | card-flip | 7 |
| 13 | `svg-animation/line-draw` | svg-animation 1 | dom | auto | css, svg | novice | — | 8 |
| 14 | `scroll-driven/scroll-progress` | scroll-driven 2 | dom | auto | css | intermediate | — | 8 |
| 15 | `accessibility/reduced-motion-swap` | accessibility 1 | dom | auto | css | novice | — | 9 |
| 16 | `interruption-state/reversible-hover` | interruption-state 1 | dom | auto | css | intermediate | — | 9 |

**Requirement coverage.** Runtimes: `dom` (13), `react` (#3), `module` (#4, #5 — first-ever exercise of the pure-TS lane). Grade modes: `auto` (14), `hybrid` (#3), `rubric` (#11). Families: CSS transitions (Plan 01's `hover-lift`, plus #16), keyframes (#1), transforms (#12), easing (#10, #11); Tailwind basics (#6) AND custom `@theme` (#7 — the Plan 02 open-question-2 pressure test); JS: waapi (#2), raf-tweening (#8), easing-math (#4), spring-physics (#5); motion vanilla (#9) AND motion-react (#3); svg (#13); scroll-driven (#14); accessibility (#15); interruption-state (#16). Complete series: **bounce-in** (all three members, three distinct categories, landed in one task). Partial series data for the new integrity rules: `card-flip` (1 member), `spring-settle` (1 member).

Category ceilings after this plan (all within `plannedCount`): css-transitions 1/6 (from Plan 01), css-keyframes 1/6, transforms-3d 1/6, easing-timing 2/6, tailwind-basics 1/6, tailwind-custom 1/6, waapi 1/6, raf-tweening 1/7, easing-math 1/6, spring-physics 1/5, scroll-driven 1/6, motion-core 1/5, motion-react-basics 1/7, svg-animation 1/6, accessibility 1/5, interruption-state 1/5. Registry total: 17 of 123.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/challenges/integrity.ts` | Modify: three series-membership rules (Task 1) |
| `src/challenges/integrity.test.ts` | Modify: violating fixtures for each new rule (Task 1) |
| `src/sandbox/grader-utils.ts` | New: shared grader helpers — `pxNumber`, `numericFunction`, plus a re-export of `forEachStep` from `@/sandbox/sequence` (Task 2) |
| `src/sandbox/grader-utils.test.ts` | New: node tests for the helpers (Task 2) |
| `src/challenges/<category>/<slug>.ts` | One module per challenge (Tasks 3–9); collected by the existing registry glob |
| `src/challenges/<category>/<slug>.grade.ts` | One grader per `auto`/`hybrid` challenge; collected by the existing sandbox glob |
| `src/challenges/vertical-slice.test.ts` | New: coverage regression pinning the slice's shape (Task 10) |

Grader helpers live in `src/sandbox/`, **never** in `src/challenges/<category>/` — the registry glob (`./*/*.ts`, excluding only `*.grade.ts` and `*.test.ts`) would try to validate any helper there as a challenge and fail the registry.

## Authoring conventions every content task follows

1. **Goal→assertion map.** Each challenge task contains a table mapping every goal to the assertion(s) that check it (or to `rubric` for perceptual goals). The implementer re-reads the map against the finished grader before committing.
2. **Preconditions.** `throw new Error(...)` only when every later assertion would be noise (required starter markup missing — the user deleted a class the brief told them to keep). When a *behaviour* is missing (no animation started), record a hinted failing `ctx.expect` and `return` — the report then leads with the one failure that matters.
3. **Epsilons.** Positions 0.5–2 px (wider when sampling mid-flight), scales/opacity 0.02–0.05, pure math 1e-9. Parse computed px/unitless strings with `pxNumber` (Task 2); `NaN` propagates into a failing `expectClose` rather than a throw.
4. **Determinism.** CSS/WAAPI state is read through `seek`/`styleAt`/`settle` — never wall-clock waiting. rAF and motion-spring state is read through `stepFrames` (n frames of motion, exactly). Frame-sampling loops use `forEachStep`. No challenge relies on `setTimeout`/`setInterval` for its animation (the virtual clock does not patch timers).
5. **Every assertion's `hint` teaches.** It names the CSS property, utility, or API call the user is missing — the failure message is the lesson, not a stack trace.
6. **Durations** sit in the 250–1200 ms band: long enough for stable mid-flight reads, short enough that `settle()` (3 s wall-clock cap) always completes. Graders that sample hundreds of virtual frames set `graderTimeoutMs: 10_000` explicitly.

---

## Task 1: Series-membership integrity rules

**Files:**
- Modify: `src/challenges/integrity.ts`
- Test: `src/challenges/integrity.test.ts`

**Interfaces:**
- Consumes: `SERIES` and `SERIES_IDS` from `@/challenges/series` (`interface Series { id: SeriesId; label: string; blurb: string; plannedMembers: number }`); `CatalogEntry` and the existing `checkCatalogIntegrity(challenges: readonly CatalogEntry[]): string[]` in `src/challenges/integrity.ts`; the fixture helper `entry(overrides: Partial<CatalogEntry>): CatalogEntry` already defined in `integrity.test.ts`.
- Produces: `checkCatalogIntegrity` additionally enforces, for every series defined in `SERIES`: (a) authored members never exceed `plannedMembers`; (b) every member's `series.label` equals the series definition's `label`; (c) no two members share a `categoryId` (spec §4.2: members live in different categories — that is the cross-technique point). The function stays pure and its signature is unchanged; the existing real-registry binding in `catalog-integrity.test.ts` picks the new rules up with no edit.

This is the Plan 01 carried-forward item this plan owns: "Series membership is unverified. `plannedMembers: 3` is asserted, but nothing compares it against authored content." The rules are ceilings and consistency checks, not completeness checks — series fill up across Plans 03 and 06, and a series with one authored member is legal. The last content batch owns equality.

- [ ] **Step 1: Write the failing tests**

Append a new `describe` block to `src/challenges/integrity.test.ts`, plus one fixture helper next to the existing `manyIn` helper:

```ts
function bounceInMember(id: string, categoryId: CategoryId, label = 'Bounce-in entrance'): CatalogEntry {
  return entry({ id, categoryId, series: { id: 'bounce-in', label } });
}
```

```ts
describe('series membership', () => {
  it('accepts a fully authored series: planned count reached, labels matching, categories distinct', () => {
    const violations = checkCatalogIntegrity([
      bounceInMember('css-keyframes/bounce-in', 'css-keyframes'),
      bounceInMember('waapi/bounce-in', 'waapi'),
      bounceInMember('motion-react-basics/bounce-in-spring', 'motion-react-basics'),
    ]);

    expect(violations).toEqual([]);
  });

  it('accepts a partially authored series — completeness belongs to the last content batch', () => {
    expect(checkCatalogIntegrity([bounceInMember('css-keyframes/bounce-in', 'css-keyframes')])).toEqual([]);
  });

  it('reports a series that exceeds its planned member count', () => {
    const violations = checkCatalogIntegrity([
      bounceInMember('css-keyframes/bounce-in', 'css-keyframes'),
      bounceInMember('waapi/bounce-in', 'waapi'),
      bounceInMember('motion-react-basics/bounce-in-spring', 'motion-react-basics'),
      bounceInMember('motion-core/bounce-in', 'motion-core'),
    ]);

    expect(violations).toEqual(['series "bounce-in": 4 members exceeds the planned 3']);
  });

  it('reports a member whose label does not match the series definition', () => {
    const violations = checkCatalogIntegrity([bounceInMember('css-keyframes/bounce-in', 'css-keyframes', 'Bounce!')]);

    expect(violations).toEqual([
      'css-keyframes/bounce-in: series label "Bounce!" does not match the series definition "Bounce-in entrance"',
    ]);
  });

  it('reports two members of one series sharing a category', () => {
    const violations = checkCatalogIntegrity([
      bounceInMember('css-keyframes/bounce-in', 'css-keyframes'),
      bounceInMember('css-keyframes/bounce-in-again', 'css-keyframes'),
    ]);

    expect(violations).toEqual([
      'series "bounce-in": "css-keyframes/bounce-in" and "css-keyframes/bounce-in-again" are both in category ' +
        '"css-keyframes" — series members must come from distinct categories (spec §4.2)',
    ]);
  });

  it('leaves an unknown series id to the existing unknown-id rule, without label or category noise', () => {
    const violations = checkCatalogIntegrity([entry({ series: { id: 'not-a-series', label: 'Nope' } })]);

    expect(violations).toEqual(['css-transitions/hover-lift: unknown series id "not-a-series"']);
  });
});
```

Why these fixtures discriminate (standing lesson 1): the clean-series fixture fails if any new rule misfires on valid data; each violating fixture isolates exactly one rule and asserts the *entire* violation list, so an inverted or deleted rule cannot hide behind another rule's message.

- [ ] **Step 2: Run the tests, watch them fail**

Run: `pnpm test:unit src/challenges/integrity.test.ts`
Expected: FAIL — the three violation tests report empty arrays (rules not implemented). The two acceptance tests pass vacuously; that is fine, the mutation check in Step 5 proves they can fail.

- [ ] **Step 3: Implement the rules**

In `src/challenges/integrity.ts`, change the series import to bring in the definitions as well:

```ts
import { SERIES, SERIES_IDS } from '@/challenges/series';
```

Then insert the following block inside `checkCatalogIntegrity`, after the per-entry `for` loop and before the per-category ceiling loop:

```ts
  // Series membership (spec §4.2). Ceilings and consistency, not completeness: series fill up
  // across Plans 03 and 06, so a partially authored series is legal. The last content batch owns
  // tightening member counts to equality, alongside the category ceilings.
  const membersBySeries = new Map<string, CatalogEntry[]>();
  for (const entry of challenges) {
    const ref = entry.series;
    if (ref === undefined) continue;
    const members = membersBySeries.get(ref.id) ?? [];
    members.push(entry);
    membersBySeries.set(ref.id, members);
  }

  for (const series of SERIES) {
    const members = membersBySeries.get(series.id) ?? [];

    if (members.length > series.plannedMembers) {
      violations.push(`series "${series.id}": ${members.length} members exceeds the planned ${series.plannedMembers}`);
    }

    for (const member of members) {
      if (member.series?.label !== series.label) {
        violations.push(
          `${member.id}: series label "${member.series?.label ?? ''}" does not match the series definition ` +
            `"${series.label}"`,
        );
      }
    }

    const firstInCategory = new Map<string, string>();
    for (const member of members) {
      const existing = firstInCategory.get(member.categoryId);
      if (existing === undefined) {
        firstInCategory.set(member.categoryId, member.id);
      } else {
        violations.push(
          `series "${series.id}": "${existing}" and "${member.id}" are both in category "${member.categoryId}" — ` +
            `series members must come from distinct categories (spec §4.2)`,
        );
      }
    }
  }
```

Iterating `SERIES` (not the collected map keys) is deliberate: an unknown series id is already reported by the existing `SERIES_IDS` rule, and skipping it here keeps that violation list to exactly one message per defect.

- [ ] **Step 4: Run the tests, watch them pass**

Run: `pnpm test:unit src/challenges/integrity.test.ts`
Expected: PASS — all existing tests plus the six new ones. (The pre-existing `accepts a known series id` fixture uses `{ id: 'card-flip', label: 'Card flip' }`, which matches the `SERIES` definition, so it stays green.)

- [ ] **Step 5: Mutation checks — each rule catches its defect class**

1. Temporarily change `members.length > series.plannedMembers` to `>=`. Expected: the fully-authored-series test FAILS (three members wrongly flagged). Restore.
2. Temporarily delete the label-comparison `for` loop. Expected: the label-mismatch test FAILS (empty violations). Restore.
3. Temporarily delete the `firstInCategory` loop. Expected: the shared-category test FAILS. Restore.
4. Temporarily make the label comparison always true (`member.series?.label === member.series?.label`). Expected: the label-mismatch test FAILS — proving the fixture detects an inverted rule, not just a deleted one. Restore.

- [ ] **Step 6: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/integrity.ts src/challenges/integrity.test.ts
git commit -m "feat(challenges): verify series membership in catalog integrity"
```

---

## Task 2: Shared grader utilities

**Files:**
- Create: `src/sandbox/grader-utils.ts`
- Test: `src/sandbox/grader-utils.test.ts`

**Interfaces:**
- Consumes: `forEachStep(count: number, action: (index: number) => Promise<void | boolean>, index?: number): Promise<void>` from `@/sandbox/sequence` (Plan 02, as amended) — awaits `action(0) … action(count − 1)` strictly in order, recursive because `eslint(no-await-in-loop)` is an error in this repo; an action resolving `false` stops the remaining steps (bounded polling).
- Produces (imported by graders in Tasks 3–9 and by every Plan 06 grader):
  - `forEachStep` — re-exported from `@/sandbox/sequence` (Plan 02), so graders import every helper from one module. Grader actions returning `Promise<void>` are assignable to `Promise<void | boolean>`; none of this plan's graders use the early-stop.
  - `pxNumber(value: string): number` — `Number.parseFloat` for computed values like `'400px'`, `'0.6'`, `'-6px'`; returns `NaN` for unparsable input so a bad read surfaces as a failing `expectClose`, never a grader throw.
  - `type NumericFunction = (...args: readonly number[]) => number`
  - `numericFunction(value: unknown): NumericFunction | null` — wraps an unknown module export for `runtime: 'module'` graders without a type assertion: `null` when not callable; non-numeric return values become `NaN`.

These live in `src/sandbox/` so the challenge-registry glob never sees them, and so graders — which already import `@/sandbox/grade-context` — pull them into the same sandbox chunk.

- [ ] **Step 1: Write the failing tests**

The three `forEachStep` tests below import through the re-export, so they exercise Plan 02's shared implementation in `src/sandbox/sequence.ts` — zero-drift: if the shared helper regresses, these tests fail even though this task owns no implementation of it.

Create `src/sandbox/grader-utils.test.ts`:

```ts
import { expect, test } from 'vitest';

import { forEachStep, numericFunction, pxNumber } from '@/sandbox/grader-utils';

test('forEachStep awaits the action once per index, in order', async () => {
  const seen: number[] = [];
  await forEachStep(4, async (index) => {
    // A real await between pushes: out-of-order execution or a skipped index cannot slip through.
    await Promise.resolve();
    seen.push(index);
  });
  expect(seen).toEqual([0, 1, 2, 3]);
});

test('forEachStep with a count of zero never calls the action', async () => {
  let calls = 0;
  await forEachStep(0, async () => {
    calls += 1;
    return Promise.resolve();
  });
  expect(calls).toBe(0);
});

test('forEachStep waits for each action before starting the next', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  await forEachStep(3, async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
  });
  expect(maxInFlight).toBe(1);
});

test('pxNumber parses computed px and unitless strings, and NaNs the unparsable', () => {
  expect(pxNumber('400px')).toBe(400);
  expect(pxNumber('-6px')).toBe(-6);
  expect(pxNumber('0.6')).toBe(0.6);
  expect(Number.isNaN(pxNumber('auto'))).toBe(true);
  expect(Number.isNaN(pxNumber(''))).toBe(true);
});

test('numericFunction rejects non-functions', () => {
  expect(numericFunction(undefined)).toBeNull();
  expect(numericFunction(42)).toBeNull();
  expect(numericFunction({ call: 'me' })).toBeNull();
});

test('numericFunction wraps a real function and forwards arguments', () => {
  const wrapped = numericFunction((a: number, b: number) => a + b);
  expect(wrapped).not.toBeNull();
  expect(wrapped?.(2, 3)).toBe(5);
});

test('numericFunction turns non-numeric returns into NaN instead of leaking them', () => {
  const wrapped = numericFunction(() => 'not a number');
  expect(Number.isNaN(wrapped?.(1) ?? 0)).toBe(true);
});
```

- [ ] **Step 2: Run the tests, watch them fail**

Run: `pnpm test:unit src/sandbox/grader-utils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `src/sandbox/grader-utils.ts`:

```ts
/**
 * Shared helpers for challenge graders (`src/challenges/<category>/<slug>.grade.ts`).
 *
 * They live in `src/sandbox/`, not in a category directory, because the challenge-registry glob
 * (`./*/*.ts` minus grade/test files) would try to validate any module it finds there as a
 * challenge definition and fail the registry.
 *
 * `forEachStep` is re-exported from `@/sandbox/sequence` (Plan 02's shared recursive stepper — the
 * lint config errors on `await` inside loop syntax) so graders import every helper from one place.
 * Frame-sampling graders call it with `ctx.time.stepFrames(1)` inside the action; recursion depth
 * equals the step count, which stays in the low hundreds.
 */
export { forEachStep } from '@/sandbox/sequence';

/**
 * `Number.parseFloat` for computed style strings (`'400px'` → 400, `'0.6'` → 0.6). Unparsable
 * input becomes `NaN`, which fails any `expectClose` it reaches — a bad read surfaces as a hinted
 * failing assertion, never an opaque grader throw.
 */
export function pxNumber(value: string): number {
  return Number.parseFloat(value);
}

export type NumericFunction = (...args: readonly number[]) => number;

/**
 * Narrows an unknown module export (`ctx.moduleExports['lerp']`) to a callable numeric function
 * without a type assertion. Returns `null` when the export is not a function; a call whose result
 * is not a number returns `NaN`, so a wrong-shaped implementation fails numerically instead of
 * throwing mid-grade.
 */
export function numericFunction(value: unknown): NumericFunction | null {
  if (typeof value !== 'function') return null;
  return (...args: readonly number[]): number => {
    const result: unknown = Reflect.apply(value, undefined, [...args]);
    return typeof result === 'number' ? result : Number.NaN;
  };
}
```

- [ ] **Step 4: Run the tests, watch them pass**

Run: `pnpm test:unit src/sandbox/grader-utils.test.ts`
Expected: PASS — seven tests.

- [ ] **Step 5: Mutation checks**

The first two mutations edit **`src/sandbox/sequence.ts`** (Plan 02's file) — deliberately: they prove this task's tests guard the shared implementation *through* the re-export, not a local copy.

1. In `src/sandbox/sequence.ts`, temporarily swap `forEachStep`'s two awaits' order (`await forEachStep(...)` before `await action(index)`). Expected: the in-order test FAILS (`[3, 2, 1, 0]`). Restore.
2. In `src/sandbox/sequence.ts`, temporarily change the base case to `index > count`. Expected: the zero-count test FAILS (one extra call) and the in-order test FAILS (`[0, 1, 2, 3, 4]`). Restore.
3. In `numericFunction` (in `grader-utils.ts`), temporarily change the non-number branch of the ternary to return `0` instead of `Number.NaN`. Expected: the non-numeric-return test FAILS (0 is not NaN). Restore.

- [ ] **Step 6: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/sandbox/grader-utils.ts src/sandbox/grader-utils.test.ts
git commit -m "feat(sandbox): shared grader utilities for stepping, parsing, and module exports"
```

---
## Task 3: The bounce-in series — CSS keyframes, WAAPI, and motion react

**Files:**
- Create: `src/challenges/css-keyframes/bounce-in.ts`, `src/challenges/css-keyframes/bounce-in.grade.ts`, `src/challenges/waapi/bounce-in.ts`, `src/challenges/waapi/bounce-in.grade.ts`, `src/challenges/motion-react-basics/bounce-in-spring.ts`, `src/challenges/motion-react-basics/bounce-in-spring.grade.ts`

**Interfaces:**
- Consumes: `Challenge` from `@/challenges/types`; `GradeContext` (type) from `@/sandbox/grade-context` — this task uses `query`, `animations`, `keyframesOf`, `timingOf`, `hasKeyframesRule`, `cssRules`, `computed`, `matrix`, `expect`, `expectClose`, `time.seek(ms)`, `time.settle()`, `time.stepFrames(n)`; `forEachStep`, `pxNumber` from `@/sandbox/grader-utils` (Task 2); the `pnpm test:catalog` gate (Plan 02 Task 14). Sandbox import map provides `motion/react` for user code (named imports only; JSX needs no React import).
- Produces: three registry challenges — the complete `bounce-in` series (spec §4.2) — plus their graders. `motion-react-basics/bounce-in-spring` is the slice's `hybrid` challenge and the first `react`-runtime content; it demonstrates the per-challenge `graderTimeoutMs` override and the frame-sampling grader pattern Plan 06 copies for every motion challenge.

All three land in one task because series members cross-reference each other via `relatedIds`, and the static integrity suite (which runs on every commit) rejects a reference to a challenge that does not exist yet.

The series contract: all three reference solutions produce the *same observable entrance* — start at half size and transparent, overshoot ~1.1×, settle at full size — so the explanations can genuinely compare techniques (spec §4.2: "written to compare against each other").

- [ ] **Step 1: Write the three challenge modules**

Create `src/challenges/css-keyframes/bounce-in.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'css-keyframes/bounce-in',
  title: 'Bounce-in entrance',
  categoryId: 'css-keyframes',
  difficulty: 'novice',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 8,
  tags: ['keyframes', 'animation', 'fill-mode', 'overshoot'],
  brief: [
    'The badge just sits there. Give it an entrance.',
    '',
    'Animate it in with a `@keyframes` rule named `bounce-in`: it starts at half size and invisible,',
    'overshoots to 1.1× at the 60% mark, and settles at full size. 500ms, played once, end state held.',
  ].join('\n'),
  goals: [
    'The badge animates in through a `@keyframes` rule named `bounce-in`.',
    'It starts at `scale(0.5)` and `opacity: 0`.',
    'At 60% of the animation the badge reads `scale(1.1)` — the overshoot frame.',
    'The animation runs 500ms, once, and its fill mode holds the end state: `scale(1)`, fully opaque.',
  ],
  starter: {
    'index.html': '<div class="badge">New!</div>\n',
    'styles.css': [
      '.badge {',
      '  display: grid;',
      '  place-items: center;',
      '  width: 96px;',
      '  height: 96px;',
      '  border-radius: 50%;',
      '  background: #0ea5e9;',
      '  color: white;',
      '  font: 600 16px/1 system-ui, sans-serif;',
      '}',
      '',
      '/* Declare the bounce-in keyframes and play them on .badge. */',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<div class="badge">New!</div>\n',
    'styles.css': [
      '.badge {',
      '  display: grid;',
      '  place-items: center;',
      '  width: 96px;',
      '  height: 96px;',
      '  border-radius: 50%;',
      '  background: #0ea5e9;',
      '  color: white;',
      '  font: 600 16px/1 system-ui, sans-serif;',
      '  animation: bounce-in 500ms ease-out both;',
      '}',
      '',
      '@keyframes bounce-in {',
      '  from {',
      '    transform: scale(0.5);',
      '    opacity: 0;',
      '  }',
      '',
      '  60% {',
      '    transform: scale(1.1);',
      '    opacity: 1;',
      '  }',
      '',
      '  to {',
      '    transform: scale(1);',
      '    opacity: 1;',
      '  }',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'A `@keyframes` rule is a named timeline: `from` is the pre-entrance state, the `60%` frame is the',
    'overshoot, and `to` is rest. The `animation` shorthand on `.badge` binds the timeline to the element',
    'with a duration (500ms) and a fill mode.',
    '',
    '### The overshoot is just a keyframe',
    '',
    'No physics involved: passing *through* `scale(1.1)` on the way to `scale(1)` is what reads as a',
    'bounce. In CSS, `animation-timing-function` applies **between keyframes**, so `ease-out` shapes each',
    'segment — but at the 60% mark the value is exactly `scale(1.1)` regardless of easing.',
    '',
    '### Why `both` matters',
    '',
    'Without a fill mode the badge snaps back to its static styles the instant the animation ends —',
    'the classic "my entrance un-happens" bug. `both` applies the `from` frame before the animation',
    'starts and holds `to` afterwards.',
    '',
    '### The same entrance, two other ways',
    '',
    'This series rebuilds the identical bounce with `element.animate()` (`waapi/bounce-in`, where the',
    'default easing is linear per effect, not per segment) and with a real spring in motion',
    '(`motion-react-basics/bounce-in-spring`, where the overshoot emerges from physics instead of a',
    'hand-placed frame).',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Two pieces: a `@keyframes bounce-in { … }` rule, and an `animation:` shorthand on `.badge` that plays it.',
    'The overshoot is one keyframe: `60% { transform: scale(1.1); }` between `from` and `to`.',
    'If the badge snaps back to full size at the end, you are missing `animation-fill-mode` — `both` (or `forwards`) holds the final frame.',
  ],
  series: { id: 'bounce-in', label: 'Bounce-in entrance' },
  relatedIds: ['waapi/bounce-in', 'motion-react-basics/bounce-in-spring'],
};
```

Create `src/challenges/waapi/bounce-in.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'waapi/bounce-in',
  title: 'Bounce-in via WAAPI',
  categoryId: 'waapi',
  difficulty: 'intermediate',
  tech: ['waapi', 'ts'],
  runtime: 'dom',
  estimatedMinutes: 10,
  tags: ['waapi', 'element-animate', 'keyframes', 'fill'],
  brief: [
    'Rebuild the bounce-in entrance from `css-keyframes/bounce-in` — this time entirely in JavaScript',
    'with `element.animate()`. The stylesheet stays static: no `@keyframes` at all.',
    '',
    'Same shape as the CSS version: `scale(0.5)` and transparent at the start, `scale(1.1)` at the 60%',
    'mark, `scale(1)` at the end. 500ms, linear effect easing, `fill: "forwards"`.',
  ].join('\n'),
  goals: [
    'The entrance is built with `element.animate()` — the stylesheet declares no `@keyframes` rule.',
    'The badge starts at half size and fully transparent, and a middle keyframe creates the overshoot.',
    'The effect runs 500ms with linear easing, so at 300ms (offset 0.6) the badge reads exactly `scale(1.1)`.',
    '`fill: "forwards"` holds the end state: after the animation the badge rests at full size, fully opaque.',
  ],
  starter: {
    'index.html': '<div class="badge">New!</div>\n',
    'styles.css': [
      '.badge {',
      '  display: grid;',
      '  place-items: center;',
      '  width: 96px;',
      '  height: 96px;',
      '  border-radius: 50%;',
      '  background: #0ea5e9;',
      '  color: white;',
      '  font: 600 16px/1 system-ui, sans-serif;',
      '}',
      '',
    ].join('\n'),
    'index.ts': [
      "const badge = document.querySelector('.badge');",
      '',
      '// Build the bounce-in entrance with badge.animate(keyframes, options).',
      'void badge;',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<div class="badge">New!</div>\n',
    'styles.css': [
      '.badge {',
      '  display: grid;',
      '  place-items: center;',
      '  width: 96px;',
      '  height: 96px;',
      '  border-radius: 50%;',
      '  background: #0ea5e9;',
      '  color: white;',
      '  font: 600 16px/1 system-ui, sans-serif;',
      '}',
      '',
    ].join('\n'),
    'index.ts': [
      "const badge = document.querySelector('.badge');",
      '',
      'if (badge) {',
      '  badge.animate(',
      '    [',
      "      { transform: 'scale(0.5)', opacity: 0 },",
      "      { transform: 'scale(1.1)', opacity: 1, offset: 0.6 },",
      "      { transform: 'scale(1)', opacity: 1 },",
      '    ],',
      "    { duration: 500, easing: 'linear', fill: 'forwards' },",
      '  );',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    '`element.animate(keyframes, options)` builds the same kind of animation object the CSS engine',
    'builds from `@keyframes` — but constructed at runtime, returned to you, and controllable',
    '(`pause()`, `reverse()`, `finished`). The keyframe array maps one-to-one onto the CSS version;',
    '`offset: 0.6` is the WAAPI spelling of the `60%` selector.',
    '',
    '### The easing difference that bites everyone',
    '',
    'CSS applies `animation-timing-function` **between keyframes**; WAAPI applies `easing` from the',
    'options across the **whole effect** by warping iteration progress. The CSS default is `ease`; the',
    "WAAPI default is `linear`. That is why this challenge pins `easing: 'linear'`: with linear effect",
    'easing, 300ms into a 500ms effect is exactly progress 0.6, and the badge reads exactly the 0.6',
    'keyframe. Per-keyframe easing exists in WAAPI too — as an `easing` property *on a keyframe* —',
    'and that is the one that matches CSS semantics.',
    '',
    '### `fill: "forwards"` is `animation-fill-mode`',
    '',
    'Same rule as the CSS version: without a fill the effect stops applying when it finishes and the',
    'badge snaps back. (WAAPI purists later call `commitStyles()` and cancel the animation to move the',
    'end state into the style attribute — that trick has its own challenge in this category.)',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'The keyframe array takes plain objects: `{ transform: "scale(0.5)", opacity: 0 }` first, the rest after.',
    'Place the overshoot frame with an explicit `offset: 0.6` — without it, keyframes distribute evenly.',
    'The options object needs `duration: 500`, `easing: "linear"`, and `fill: "forwards"` so the end state sticks.',
  ],
  series: { id: 'bounce-in', label: 'Bounce-in entrance' },
  relatedIds: ['css-keyframes/bounce-in', 'motion-react-basics/bounce-in-spring'],
};
```

Create `src/challenges/motion-react-basics/bounce-in-spring.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'motion-react-basics/bounce-in-spring',
  title: 'Bounce-in with a spring',
  categoryId: 'motion-react-basics',
  difficulty: 'novice',
  tech: ['react', 'motion'],
  runtime: 'react',
  estimatedMinutes: 10,
  tags: ['motion', 'react', 'spring', 'initial-animate'],
  graderTimeoutMs: 10_000,
  brief: [
    'Third take on the bounce-in entrance: let a spring do the bouncing.',
    '',
    'Render the badge as a `motion.div` that mounts at half size and transparent, then springs to full',
    'size and opacity. No keyframes and no overshoot frame — pick `stiffness` and `damping` so the',
    'overshoot emerges from the physics.',
  ].join('\n'),
  goals: [
    'The badge mounts at half size and transparent (`initial`), then animates to full size and opacity (`animate`).',
    'The scale overshoots past 1 on the way in — spring physics, not a hand-placed keyframe.',
    'It comes to rest at exactly full size and full opacity.',
    'The spring feels lively: a quick pop that settles within about a second.',
  ],
  starter: {
    'App.tsx': [
      'export default function App() {',
      '  return <div className="badge">New!</div>;',
      '}',
      '',
    ].join('\n'),
    'styles.css': [
      '.badge {',
      '  display: grid;',
      '  place-items: center;',
      '  width: 96px;',
      '  height: 96px;',
      '  border-radius: 50%;',
      '  background: #0ea5e9;',
      '  color: white;',
      '  font: 600 16px/1 system-ui, sans-serif;',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'App.tsx': [
      "import { motion } from 'motion/react';",
      '',
      'export default function App() {',
      '  return (',
      '    <motion.div',
      '      className="badge"',
      '      initial={{ scale: 0.5, opacity: 0 }}',
      '      animate={{ scale: 1, opacity: 1 }}',
      "      transition={{ type: 'spring', stiffness: 260, damping: 12 }}",
      '    >',
      '      New!',
      '    </motion.div>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'styles.css': [
      '.badge {',
      '  display: grid;',
      '  place-items: center;',
      '  width: 96px;',
      '  height: 96px;',
      '  border-radius: 50%;',
      '  background: #0ea5e9;',
      '  color: white;',
      '  font: 600 16px/1 system-ui, sans-serif;',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    '`initial` is the mounted state, `animate` is the target, and motion animates between them on',
    'mount. With `type: "spring"` the trajectory is simulated physics: stiffness is the pull toward',
    'the target, damping is the friction that stops it. At stiffness 260 / damping 12 the badge is',
    'underdamped — it shoots past scale 1, comes back, and settles. The overshoot the other two',
    'series members hand-authored as a `scale(1.1)` keyframe *emerges* here, and its size changes',
    'when you tune the physics.',
    '',
    '### No duration',
    '',
    'A spring does not take a duration — it takes physics, and runs until it comes to rest. That is',
    'the deep difference from `css-keyframes/bounce-in` and `waapi/bounce-in`, where 500ms was a hard',
    'promise. If you find yourself wanting "a spring that lasts exactly 500ms", motion supports',
    '`duration`/`bounce` as an alternative spring parameterisation — traded for direct control of',
    'stiffness.',
    '',
    '### Reading the numbers',
    '',
    'Lower damping → bigger overshoot and longer wobble. Higher stiffness → faster attack. The',
    'reference values (260/12) pop in and settle in roughly three quarters of a second.',
  ].join('\n'),
  gradeMode: 'hybrid',
  rubric: [
    {
      id: 'lively',
      label: 'The entrance feels lively — a quick pop with a visible bounce, not a slow drift.',
    },
    {
      id: 'settles-clean',
      label: 'It settles cleanly, without lingering vibration after the first bounce or two.',
    },
    {
      id: 'matches-target',
      label: 'Side by side with the target, the spring character feels the same.',
      detail: 'Tune stiffness and damping until the motion — not just the end state — matches.',
    },
  ],
  hints: [
    'Import `{ motion }` from `motion/react` and change the `div` to `motion.div`.',
    'Mount-time entrances are the `initial` + `animate` pair — put the pre-entrance state in `initial`.',
    "The bounce comes from `transition={{ type: 'spring', stiffness: 260, damping: 12 }}` — lower damping, bigger bounce.",
  ],
  series: { id: 'bounce-in', label: 'Bounce-in entrance' },
  relatedIds: ['css-keyframes/bounce-in', 'waapi/bounce-in'],
};
```

- [ ] **Step 2: Watch the catalog gate demand the graders**

Run: `pnpm test:catalog`
Expected: FAIL — the "grader files match gradeMode" suite reports `css-keyframes/bounce-in (auto) has a grader`, `waapi/bounce-in (auto) has a grader`, and `motion-react-basics/bounce-in-spring (hybrid) has a grader` all failing (no grader files exist yet). Rule 5 for the three ids also fails — `runGrade` reports a thrown `no grader is registered for "…"` — and rule 6 passes vacuously through that same throw; the grader-file failures are the signal. Rule 3 passes for all three (both file sets transpile). This is the content TDD cycle's observed failing state.

- [ ] **Step 3: Write the three graders**

Goal→assertion maps (verify each row against the code before committing):

`css-keyframes/bounce-in` — goals from Step 1:

| Goal | Assertion(s) |
| --- | --- |
| 1 — `@keyframes bounce-in` drives it | `hasKeyframesRule('bounce-in')`; a `CSSAnimation` named `bounce-in` on `.badge` |
| 2 — starts at `scale(0.5)`, `opacity: 0` | at `seek(0)`: `matrix().a ≈ 0.5`; computed opacity ≈ 0 |
| 3 — `scale(1.1)` at 60% | at `seek(300)`: `matrix().a ≈ 1.1` (keyframe values are exact at their own offset regardless of easing) |
| 4 — 500ms, once, fill holds end state | `timingOf`: duration 500, iterations 1, fill `both`/`forwards`; after `settle()`: `matrix().a ≈ 1`, opacity ≈ 1 |

Create `src/challenges/css-keyframes/bounce-in.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const SCALE_EPSILON = 0.02;
const OPACITY_EPSILON = 0.02;

/**
 * Grades `css-keyframes/bounce-in`: a `@keyframes bounce-in` entrance from scale(0.5)/opacity 0,
 * through scale(1.1) at 60%, to scale(1) — 500ms, once, end state held by the fill mode.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const badge = ctx.query('.badge');
  if (badge === null) {
    throw new Error('the grader needs the `.badge` element from the starter markup — keep the class name');
  }

  ctx.expect(ctx.hasKeyframesRule('bounce-in'), {
    message: 'A `@keyframes` rule named `bounce-in` exists',
    hint: 'Declare `@keyframes bounce-in { from { … } 60% { … } to { … } }` in styles.css.',
  });

  const animation =
    ctx.animations(badge).find((candidate) => candidate instanceof CSSAnimation && candidate.animationName === 'bounce-in') ??
    null;
  ctx.expect(animation !== null, {
    message: 'The badge is playing the `bounce-in` animation',
    hint: 'Bind the keyframes with the shorthand: `animation: bounce-in 500ms ease-out both;` on `.badge`.',
    actual: ctx.animations(badge).length === 0 ? 'no animations on .badge' : 'animations with other names only',
    expected: 'a CSS animation named `bounce-in`',
  });
  if (animation === null) return;

  const timing = ctx.timingOf(animation);
  ctx.expect(timing.duration === 500, {
    message: 'The animation runs for 500ms',
    hint: 'Set the duration in the shorthand: `animation: bounce-in 500ms …`.',
    actual: timing.duration,
    expected: 500,
  });
  ctx.expect(timing.iterations === 1, {
    message: 'The entrance plays exactly once',
    hint: 'An entrance is not a loop — leave `animation-iteration-count` at its default of 1.',
    actual: timing.iterations,
    expected: 1,
  });
  const fill = timing.fill ?? 'none';
  ctx.expect(fill === 'both' || fill === 'forwards', {
    message: 'The fill mode holds the final frame',
    hint: 'Without `animation-fill-mode: both` (or `forwards`) the badge snaps back when the animation ends.',
    actual: fill,
    expected: "'both' or 'forwards'",
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(badge).a, 0.5, SCALE_EPSILON, {
    message: 'At 0ms the badge is at half size',
    hint: 'The `from` frame is the pre-entrance state: `transform: scale(0.5)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'At 0ms the badge is fully transparent',
    hint: 'Put `opacity: 0` in the `from` frame alongside the scale.',
  });

  await ctx.time.seek(300);
  ctx.expectClose(ctx.matrix(badge).a, 1.1, SCALE_EPSILON, {
    message: 'At 300ms — the 60% mark — the badge reads scale(1.1)',
    hint: 'The overshoot is a keyframe: `60% { transform: scale(1.1); }`.',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(badge).a, 1, SCALE_EPSILON, {
    message: 'After the animation the badge rests at full size',
    hint: 'The `to` frame is `transform: scale(1)`, and the fill mode keeps it applied.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'After the animation the badge is fully opaque',
    hint: 'End at `opacity: 1` and hold it with the fill mode.',
  });
}
```

`waapi/bounce-in` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — `element.animate()`, no `@keyframes` | zero `CSSKeyframesRule`s in `cssRules()`; an animation on `.badge` that is neither `CSSAnimation` nor `CSSTransition` |
| 2 — starts half/transparent; middle keyframe | at `seek(0)`: scale ≈ 0.5, opacity ≈ 0; `keyframesOf` contains a frame with `0 < computedOffset < 1` |
| 3 — 500ms linear; exact 1.1 at 300ms | `timingOf`: duration 500, easing `'linear'`; at `seek(300)`: scale ≈ 1.1 |
| 4 — forwards fill holds end state | `timingOf` fill `forwards`/`both`; after `settle()`: scale ≈ 1, opacity ≈ 1 |

Create `src/challenges/waapi/bounce-in.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const SCALE_EPSILON = 0.02;
const OPACITY_EPSILON = 0.02;

/**
 * Grades `waapi/bounce-in`: the same entrance as the CSS series member, built with
 * `element.animate()` — no stylesheet keyframes, linear effect easing, forwards fill.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const badge = ctx.query('.badge');
  if (badge === null) {
    throw new Error('the grader needs the `.badge` element from the starter markup — keep the class name');
  }

  const keyframesRules = ctx.cssRules().filter((rule) => rule instanceof CSSKeyframesRule);
  ctx.expect(keyframesRules.length === 0, {
    message: 'The stylesheet declares no `@keyframes` — the entrance lives in JavaScript',
    hint: 'Delete any CSS animation; build the keyframes as an array passed to `badge.animate()`.',
    actual: `${keyframesRules.length} @keyframes rule(s) in the stylesheet`,
    expected: 'none',
  });

  const animation =
    ctx
      .animations(badge)
      .find((candidate) => !(candidate instanceof CSSAnimation) && !(candidate instanceof CSSTransition)) ?? null;
  ctx.expect(animation !== null, {
    message: 'A Web Animation created by `element.animate()` is running on the badge',
    hint: 'Call `badge.animate(keyframes, options)` from index.ts.',
    actual: ctx.animations(badge).length === 0 ? 'no animations on .badge' : 'only CSS-declared animations',
    expected: 'an animation created from JavaScript',
  });
  if (animation === null) return;

  const middleFrames = ctx.keyframesOf(animation).filter((frame) => frame.computedOffset > 0 && frame.computedOffset < 1);
  ctx.expect(middleFrames.length >= 1, {
    message: 'A middle keyframe creates the overshoot',
    hint: 'Give the scale(1.1) frame `offset: 0.6` between the start and end keyframes.',
    actual: `${middleFrames.length} middle keyframe(s)`,
    expected: 'at least one keyframe strictly between offsets 0 and 1',
  });

  const timing = ctx.timingOf(animation);
  ctx.expect(timing.duration === 500, {
    message: 'The effect runs for 500ms',
    hint: 'Pass `duration: 500` in the options object.',
    actual: timing.duration,
    expected: 500,
  });
  ctx.expect(timing.easing === 'linear', {
    message: 'The effect easing is linear, so keyframe offsets map straight onto time',
    hint: "WAAPI's default is already linear — pass `easing: 'linear'` or omit it. (CSS `ease` is the CSS default, not the WAAPI one.)",
    actual: timing.easing,
    expected: 'linear',
  });
  const fill = timing.fill ?? 'none';
  ctx.expect(fill === 'forwards' || fill === 'both', {
    message: 'The fill holds the end state',
    hint: "Pass `fill: 'forwards'` — without it the badge snaps back to its static styles when the effect finishes.",
    actual: fill,
    expected: "'forwards' or 'both'",
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(badge).a, 0.5, SCALE_EPSILON, {
    message: 'At 0ms the badge is at half size',
    hint: 'The first keyframe is `{ transform: "scale(0.5)", opacity: 0 }`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'At 0ms the badge is fully transparent',
    hint: 'Put `opacity: 0` in the first keyframe.',
  });

  await ctx.time.seek(300);
  ctx.expectClose(ctx.matrix(badge).a, 1.1, SCALE_EPSILON, {
    message: 'At 300ms — offset 0.6 under linear easing — the badge reads scale(1.1)',
    hint: 'The overshoot frame is `{ transform: "scale(1.1)", opacity: 1, offset: 0.6 }`.',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(badge).a, 1, SCALE_EPSILON, {
    message: 'After the animation the badge rests at full size',
    hint: 'End the keyframe array at `scale(1)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'After the animation the badge is fully opaque',
    hint: 'End at `opacity: 1`, held by the forwards fill.',
  });
}
```

`motion-react-basics/bounce-in-spring` — goal→assertion map (hybrid: goals 1–3 are the auto portion; goal 4 is the rubric's):

| Goal | Assertion(s) |
| --- | --- |
| 1 — mounts at half size/transparent, animates to full | before any frame: scale ≈ 0.5, opacity ≈ 0 (the `initial` state under the virtual clock) |
| 2 — scale overshoots past 1 | per-frame sampling over 240 virtual frames: peak scale > 1.02 |
| 3 — rests at exactly full size and opacity | last sample ≈ 1; final opacity ≈ 1 |
| 4 — feels lively, settles within about a second | **rubric** (`lively`, `settles-clean`, `matches-target`) |

The sampling pattern below is the template for every motion/spring grader in Plan 06: springs are JS-driven (spec §6.4 — they do not go through WAAPI), so `stepFrames` advances them deterministically, and reading computed style after every single frame catches the peak wherever the physics puts it. `scaleOf` reads both the `transform` matrix and the individual `scale` property, so the grader keeps working whichever way the installed motion version writes the style.

Create `src/challenges/motion-react-basics/bounce-in-spring.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { forEachStep, pxNumber } from '@/sandbox/grader-utils';

/** 240 virtual frames = 4s at 60Hz — far beyond the reference spring's settling time (~0.8s). */
const SAMPLE_FRAMES = 240;
const SCALE_EPSILON = 0.02;

/** Effective uniform scale: the transform matrix times the individual `scale` property (if set). */
function scaleOf(ctx: GradeContext, el: Element): number {
  const individual = ctx.computed(el, 'scale');
  const parsed = individual === 'none' || individual === '' ? 1 : pxNumber(individual);
  const base = Number.isNaN(parsed) ? 1 : parsed;
  return base * ctx.matrix(el).a;
}

/**
 * Grades the auto-checkable portion of `motion-react-basics/bounce-in-spring` (hybrid): the badge
 * mounts at scale 0.5/opacity 0, overshoots past 1 under spring physics, and rests at exactly 1.
 * The perceptual half — how the spring FEELS — is the rubric's job, not this file's.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const badge = ctx.query('.badge');
  if (badge === null) {
    throw new Error('the grader needs a `.badge` element — keep the className on the motion element');
  }

  // The virtual clock has not ticked yet, so this IS the `initial` state.
  ctx.expectClose(scaleOf(ctx, badge), 0.5, 0.05, {
    message: 'Before the first animation frame the badge is at half size',
    hint: 'Give the motion element `initial={{ scale: 0.5, opacity: 0 }}` — the mounted, pre-entrance state.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 0, 0.05, {
    message: 'Before the first animation frame the badge is transparent',
    hint: 'Opacity belongs in `initial` too: the badge fades in while it scales.',
  });

  const samples: number[] = [];
  await forEachStep(SAMPLE_FRAMES, async () => {
    await ctx.time.stepFrames(1);
    samples.push(scaleOf(ctx, badge));
  });

  const peak = Math.max(...samples);
  ctx.expect(peak > 1.02, {
    message: 'The scale overshoots past 1 on the way in — spring physics at work',
    hint: "Use `transition={{ type: 'spring', stiffness: 260, damping: 12 }}`. A duration-based ease never crosses its target.",
    actual: `peak scale ${peak.toFixed(3)} over ${SAMPLE_FRAMES} frames`,
    expected: 'a peak above 1.02',
  });

  const finalScale = samples.at(-1) ?? Number.NaN;
  ctx.expectClose(finalScale, 1, SCALE_EPSILON, {
    message: 'The badge comes to rest at exactly full size',
    hint: 'Animate to `scale: 1` in the `animate` prop and let the spring settle.',
  });
  ctx.expectClose(pxNumber(ctx.computed(badge, 'opacity')), 1, SCALE_EPSILON, {
    message: 'The badge ends fully opaque',
    hint: 'Animate `opacity` to 1 alongside the scale.',
  });
}
```

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. For each of the three new challenges: rule 3 (starter + solution transpile), grader-file rule, rule 5 (solution passes — including the hybrid's auto portion), rule 6 (starter fails with hinted assertions: the CSS starter fails on the missing keyframes rule, the WAAPI starter on the missing animation, the motion starter on `initial` scale 1 and the absent overshoot). Runtime grows by roughly six mounts (~10–20s).

- [ ] **Step 5: Mutation checks — the graders police the series contract**

1. In `css-keyframes/bounce-in.ts`, temporarily change the SOLUTION's `60%` keyframe to `transform: scale(1.3);`. Run `pnpm test:catalog`. Expected: rule 5 FAILS on the 300ms assertion — a solution drifting from its stated goals is machine-caught (the Plan 01 defect class). Restore.
2. In `waapi/bounce-in.ts`, temporarily add `easing: 'ease-out'` in place of `'linear'` in the SOLUTION. Expected: rule 5 FAILS on the easing assertion AND the 300ms scale read (warped progress no longer lands on the keyframe) — the two-assertion pair that pins the CSS-vs-WAAPI easing lesson. Restore.
3. In `motion-react-basics/bounce-in-spring.ts`, temporarily change the SOLUTION's transition to `transition={{ duration: 0.5 }}` (a tween). Expected: rule 5 FAILS on the overshoot assertion — the grader genuinely distinguishes a spring from an ease. Restore.
4. In `bounce-in-spring.grade.ts`, temporarily replace `await ctx.time.stepFrames(1);` with `await Promise.resolve();` inside the sampling action. Expected: rule 5 FAILS (the spring never advances; final scale stays 0.5) — proving the sampling loop depends on the virtual clock, not wall time. Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read each challenge's `goals` array against its grader. Every auto-checkable goal has at least one assertion whose failure names that goal's fix; the hybrid's perceptual goal (4) is covered by its rubric ids. Confirm every goal is literally true of the reference solution by re-reading the solution files. This audit is a required step, not a suggestion — it is the discipline that prevents the Plan 01 hover-lift defect.

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/css-keyframes src/challenges/waapi src/challenges/motion-react-basics
git commit -m "feat(challenges): bounce-in series across css keyframes, waapi, and motion react"
```

---
## Task 4: The module lane — lerp and a fixed-timestep spring

**Files:**
- Create: `src/challenges/easing-math/lerp.ts`, `src/challenges/easing-math/lerp.grade.ts`, `src/challenges/spring-physics/spring-step.ts`, `src/challenges/spring-physics/spring-step.grade.ts`

**Interfaces:**
- Consumes: `Challenge` from `@/challenges/types`; `GradeContext` — this task uses only `moduleExports` (`Readonly<Record<string, unknown>>`, the evaluated exports of the user's `index.ts`), `expect`, `expectClose`; `numericFunction` from `@/sandbox/grader-utils`. Runtime `'module'` convention (Plan 02 Task 4): `index.ts` is the required entry; nothing is rendered.
- Produces: the first two `runtime: 'module'` challenges ever — the lane where `auto` grading is fully honest (spec §4: the grader calls the user's function directly and asserts numbers). `spring-physics/spring-step` is the first `spring-settle` series member. The narrowing pattern here (`numericFunction`, and `spring-step`'s local `toSnapshot`) is the Plan 06 template for every `easing-math` and `spring-physics` grader.

- [ ] **Step 1: Write the two challenge modules**

Create `src/challenges/easing-math/lerp.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'easing-math/lerp',
  title: 'lerp and inverseLerp',
  categoryId: 'easing-math',
  difficulty: 'novice',
  tech: ['ts'],
  runtime: 'module',
  estimatedMinutes: 8,
  tags: ['interpolation', 'math', 'pure-functions'],
  brief: [
    'Every tween, spring, and scroll-linked effect is built on one idea: blending between two numbers.',
    '',
    'Implement the two directions of that idea:',
    '',
    '- `lerp(a, b, t)` — the value a fraction `t` of the way from `a` to `b`.',
    '- `inverseLerp(a, b, value)` — the fraction at which `value` sits between `a` and `b`.',
    '',
    'Keep both functions pure, and do not clamp: callers decide whether extrapolation is wanted.',
  ].join('\n'),
  goals: [
    '`lerp(a, b, t)` returns the value a fraction `t` of the way from `a` to `b` — `lerp(10, 20, 0.5)` is `15`, and negative ranges work.',
    '`inverseLerp(a, b, value)` inverts it — `inverseLerp(10, 20, 15)` is `0.5` — so `inverseLerp(a, b, lerp(a, b, t))` round-trips to `t`.',
    'Neither function clamps: `lerp(0, 10, 1.5)` is `15`, and `inverseLerp(0, 10, -5)` is `-0.5`.',
  ],
  starter: {
    'index.ts': [
      'export function lerp(a: number, b: number, t: number): number {',
      '  // Blend a toward b by the fraction t.',
      '  return a;',
      '}',
      '',
      'export function inverseLerp(a: number, b: number, value: number): number {',
      '  // At what fraction does value sit between a and b?',
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.ts': [
      'export function lerp(a: number, b: number, t: number): number {',
      '  return a + (b - a) * t;',
      '}',
      '',
      'export function inverseLerp(a: number, b: number, value: number): number {',
      '  return (value - a) / (b - a);',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    '`a + (b - a) * t` is the whole trick: at `t = 0` the second term vanishes, at `t = 1` it is the',
    'full distance, and in between it is a proportional slice. `inverseLerp` solves the same equation',
    'for `t`. Every easing function you will write later is just a reshaping of `t` before it hits',
    'this line.',
    '',
    '### Why no clamping',
    '',
    'Clamping inside `lerp` looks helpful and quietly breaks two real uses: springs overshoot their',
    'target (`t > 1` is the overshoot), and scroll-linked values often extrapolate past their design',
    'range on rubber-band scrolls. Compose clamping *around* the primitive when a caller wants it —',
    'the range-remapping challenge later in this category does exactly that.',
    '',
    '### The `t` mental model',
    '',
    'Read `t` as "progress", not "time": `inverseLerp` converts a raw value (a scroll offset, an',
    'elapsed time) into progress, and `lerp` converts progress into an output value. Chaining them —',
    'remap — is the backbone of scroll-driven animation.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'One line each: start at `a`, add the fraction `t` of the distance `b - a`.',
    'For the inverse, ask: how far is `value` from `a`, as a share of the whole distance?',
    'If your round-trip test fails, one of the two divides or multiplies by the wrong distance.',
  ],
  relatedIds: [],
};
```

Create `src/challenges/spring-physics/spring-step.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'spring-physics/spring-step',
  title: 'A fixed-timestep spring integrator',
  categoryId: 'spring-physics',
  difficulty: 'intermediate',
  tech: ['ts'],
  runtime: 'module',
  estimatedMinutes: 15,
  tags: ['spring', 'integrator', 'physics', 'semi-implicit-euler'],
  brief: [
    'Simulate a damped spring one timestep at a time.',
    '',
    'Implement `springStep(state, config, dtSeconds)`: from the current `{ position, velocity }`,',
    'compute the spring force (`-stiffness × displacement`) and damping force (`-damping × velocity`),',
    'derive acceleration (`force / mass`), then integrate **semi-implicitly**: update velocity first,',
    'then update position using the NEW velocity. Return a fresh state object — never mutate the input.',
  ].join('\n'),
  goals: [
    'One step updates velocity first, then position from the NEW velocity (semi-implicit Euler): from rest at 0 toward target 1 with stiffness 100, damping 10, mass 1, dt 1/60, one step lands at exactly position 1/36 and velocity 5/3.',
    '`springStep` never mutates the state it is given — it returns a fresh `{ position, velocity }`.',
    'Stepped repeatedly at dt 1/60, a stiffness 170 / damping 26 / mass 1 spring converges on its target and comes to rest.',
    'With damping lowered to 8 the spring overshoots its target before settling — underdamped behaviour emerges from the maths.',
  ],
  starter: {
    'index.ts': [
      'export interface SpringState {',
      '  position: number;',
      '  velocity: number;',
      '}',
      '',
      'export interface SpringConfig {',
      '  target: number;',
      '  stiffness: number;',
      '  damping: number;',
      '  mass: number;',
      '}',
      '',
      'export function springStep(state: SpringState, config: SpringConfig, dtSeconds: number): SpringState {',
      '  // Forces: spring pulls toward the target, damping resists velocity.',
      '  // Integrate semi-implicitly: velocity first, then position from the NEW velocity.',
      '  return { position: state.position, velocity: state.velocity };',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.ts': [
      'export interface SpringState {',
      '  position: number;',
      '  velocity: number;',
      '}',
      '',
      'export interface SpringConfig {',
      '  target: number;',
      '  stiffness: number;',
      '  damping: number;',
      '  mass: number;',
      '}',
      '',
      'export function springStep(state: SpringState, config: SpringConfig, dtSeconds: number): SpringState {',
      '  const displacement = state.position - config.target;',
      '  const springForce = -config.stiffness * displacement;',
      '  const dampingForce = -config.damping * state.velocity;',
      '  const acceleration = (springForce + dampingForce) / config.mass;',
      '  const velocity = state.velocity + acceleration * dtSeconds;',
      '  const position = state.position + velocity * dtSeconds;',
      '  return { position, velocity };',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    "Hooke's law plus friction: the spring force is proportional to how far you are from the target",
    '(and points back toward it); damping is proportional to how fast you are moving (and opposes it).',
    'Dividing by mass turns force into acceleration, and then integration is just "velocity collects',
    'acceleration, position collects velocity".',
    '',
    '### Why semi-implicit Euler',
    '',
    'The order of those two updates matters more than it looks. *Explicit* Euler (position first,',
    'using the OLD velocity) systematically injects energy: at high stiffness the simulated spring',
    'gains amplitude every bounce and eventually explodes. Updating velocity first and reusing it for',
    'position (*semi-implicit*, or symplectic, Euler) slightly removes energy instead — the',
    'simulation stays stable at the stiffness values UI springs actually use. Every production',
    'animation library integrates springs this way. The first goal pins the order numerically: from',
    'rest, explicit Euler moves position 0 on the first step (old velocity is 0); semi-implicit moves',
    'it by `newVelocity × dt`.',
    '',
    '### Rest, overshoot, and what "done" means',
    '',
    'With damping 26 (near critical for stiffness 170) the spring glides in and stops. Drop damping',
    'to 8 and it is underdamped: it crosses the target, comes back, and rings down. Detecting "done"',
    '(position near target AND velocity near zero) is its own challenge later in this category.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Displacement is `position - target`; the spring force is `-stiffness * displacement`.',
    'Acceleration is `(springForce + dampingForce) / mass`; damping force is `-damping * velocity`.',
    'Order matters: `velocity += acceleration * dt` FIRST, then `position += velocity * dt` with the new velocity.',
  ],
  series: { id: 'spring-settle', label: 'Spring settle' },
  relatedIds: ['easing-math/lerp'],
};
```

- [ ] **Step 2: Watch the catalog gate demand the graders**

Run: `pnpm test:catalog`
Expected: FAIL — `easing-math/lerp (auto) has a grader` and `spring-physics/spring-step (auto) has a grader` both fail (rule 5 for both also fails with the `no grader is registered` throw); rule 3 passes for both (the `module` runtime's `index.ts` entry convention is satisfied). Incidentally this is the first time rule 3 exercises `runtime: 'module'` at all.

- [ ] **Step 3: Write the two graders**

`easing-math/lerp` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — lerp blends, negative ranges work | `lerp(0,10,0)=0`, `lerp(0,10,1)=10`, `lerp(10,20,0.5)=15`, `lerp(-4,4,0.75)=2` |
| 2 — inverseLerp inverts; round-trip | `inverseLerp(10,20,15)=0.5`, `inverseLerp(5,15,5)=0`, `inverseLerp(5,15,15)=1`, `inverseLerp(2,8,lerp(2,8,0.3))≈0.3` |
| 3 — no clamping | `lerp(0,10,1.5)=15`, `inverseLerp(0,10,-5)=-0.5` |

Create `src/challenges/easing-math/lerp.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { numericFunction } from '@/sandbox/grader-utils';

const EPSILON = 1e-9;

/**
 * Grades `easing-math/lerp` numerically: the grader calls the user's exported functions directly
 * (`runtime: 'module'` — spec §4: "this lane is where auto grading is fully honest").
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const lerp = numericFunction(ctx.moduleExports['lerp']);
  const inverseLerp = numericFunction(ctx.moduleExports['inverseLerp']);

  ctx.expect(lerp !== null, {
    message: '`lerp` is exported as a function from index.ts',
    hint: 'Keep the starter export: `export function lerp(a: number, b: number, t: number): number`.',
  });
  ctx.expect(inverseLerp !== null, {
    message: '`inverseLerp` is exported as a function from index.ts',
    hint: 'Keep the starter export: `export function inverseLerp(a: number, b: number, value: number): number`.',
  });
  if (lerp === null || inverseLerp === null) return;

  ctx.expectClose(lerp(0, 10, 0), 0, EPSILON, {
    message: '`lerp(0, 10, 0)` returns the start of the range',
    hint: 'At t = 0 the result is exactly `a`: start from `a` and add a scaled distance.',
  });
  ctx.expectClose(lerp(0, 10, 1), 10, EPSILON, {
    message: '`lerp(0, 10, 1)` returns the end of the range',
    hint: 'At t = 1 the whole distance `b - a` has been added.',
  });
  ctx.expectClose(lerp(10, 20, 0.5), 15, EPSILON, {
    message: '`lerp(10, 20, 0.5)` is the midpoint, 15',
    hint: 'The formula is `a + (b - a) * t` — check which distance you are scaling.',
  });
  ctx.expectClose(lerp(-4, 4, 0.75), 2, EPSILON, {
    message: '`lerp(-4, 4, 0.75)` handles a negative-to-positive range',
    hint: '`a + (b - a) * t` needs no special cases for sign — if this fails, you special-cased something.',
  });
  ctx.expectClose(lerp(0, 10, 1.5), 15, EPSILON, {
    message: '`lerp` extrapolates beyond t = 1 instead of clamping',
    hint: 'Do not clamp t. Springs overshoot through t > 1; clamping belongs to callers.',
  });

  ctx.expectClose(inverseLerp(10, 20, 15), 0.5, EPSILON, {
    message: '`inverseLerp(10, 20, 15)` is 0.5',
    hint: 'How far is `value` from `a`, as a share of the whole distance `b - a`?',
  });
  ctx.expectClose(inverseLerp(5, 15, 5), 0, EPSILON, {
    message: '`inverseLerp` returns 0 at the start of the range',
    hint: 'When `value === a` the numerator `value - a` is zero.',
  });
  ctx.expectClose(inverseLerp(5, 15, 15), 1, EPSILON, {
    message: '`inverseLerp` returns 1 at the end of the range',
    hint: 'When `value === b` the share is the whole distance.',
  });
  ctx.expectClose(inverseLerp(0, 10, -5), -0.5, EPSILON, {
    message: '`inverseLerp` extrapolates below the range instead of clamping',
    hint: 'A value before `a` is a negative fraction — leave it negative.',
  });
  ctx.expectClose(inverseLerp(2, 8, lerp(2, 8, 0.3)), 0.3, EPSILON, {
    message: '`inverseLerp(a, b, lerp(a, b, t))` round-trips to t',
    hint: 'If the round-trip drifts, one function scales by `b - a` and the other by something else.',
  });
}
```

`spring-physics/spring-step` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — semi-implicit single step | one step from rest: position ≈ 1/36, velocity ≈ 5/3 (explicit Euler would leave position at 0 — the pair discriminates the integration order) |
| 2 — no mutation | after calling, the original state object still reads `{ position: 0, velocity: 0 }` |
| 3 — converges and rests (170/26) | after 600 steps at dt 1/60: position ≈ target ± 1e-3, |velocity| < 1e-3 |
| 4 — underdamped overshoot (170/8) | max position across 600 steps > 1.05 |

Create `src/challenges/spring-physics/spring-step.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

const DT = 1 / 60;
const STEP_COUNT = 600; // 10 simulated seconds — every reference configuration is at rest long before this

interface SpringSnapshot {
  position: number;
  velocity: number;
}

/** Narrows an unknown return value to `{ position, velocity }` without a type assertion. */
function toSnapshot(value: unknown): SpringSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const position = 'position' in value ? value.position : undefined;
  const velocity = 'velocity' in value ? value.velocity : undefined;
  if (typeof position !== 'number' || typeof velocity !== 'number') return null;
  return { position, velocity };
}

type StepFunction = (state: SpringSnapshot, config: Record<string, number>, dt: number) => SpringSnapshot | null;

function stepFunction(value: unknown): StepFunction | null {
  if (typeof value !== 'function') return null;
  return (state, config, dt) => toSnapshot(Reflect.apply(value, undefined, [state, config, dt]));
}

/** Runs `count` steps, returning the final snapshot and the maximum position seen (for overshoot checks). */
function simulate(
  step: StepFunction,
  config: Record<string, number>,
  count: number,
): { final: SpringSnapshot; maxPosition: number } | null {
  let state: SpringSnapshot = { position: 0, velocity: 0 };
  let maxPosition = state.position;
  for (let index = 0; index < count; index += 1) {
    const next = step(state, config, DT);
    if (next === null) return null;
    state = next;
    maxPosition = Math.max(maxPosition, state.position);
  }
  return { final: state, maxPosition };
}

/**
 * Grades `spring-physics/spring-step` numerically. The single-step assertion pins semi-implicit
 * Euler exactly: velocity first (5/3 after one step), then position from the NEW velocity (1/36).
 * Explicit Euler — position first, from the old velocity of 0 — would leave position at 0.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const springStep = stepFunction(ctx.moduleExports['springStep']);
  ctx.expect(springStep !== null, {
    message: '`springStep` is exported as a function from index.ts',
    hint: 'Keep the starter export: `export function springStep(state, config, dtSeconds): SpringState`.',
  });
  if (springStep === null) return;

  const original: SpringSnapshot = { position: 0, velocity: 0 };
  const oneStep = springStep(original, { target: 1, stiffness: 100, damping: 10, mass: 1 }, DT);
  ctx.expect(oneStep !== null, {
    message: '`springStep` returns a `{ position, velocity }` object',
    hint: 'Return a fresh object with numeric `position` and `velocity` fields.',
  });
  if (oneStep === null) return;

  ctx.expectClose(oneStep.velocity, 5 / 3, 1e-9, {
    message: 'One step from rest: velocity picks up acceleration × dt (5/3)',
    hint: 'Acceleration is `(springForce + dampingForce) / mass`; from rest toward target 1 with stiffness 100 that is 100, so velocity becomes 100 × (1/60).',
  });
  ctx.expectClose(oneStep.position, 1 / 36, 1e-9, {
    message: 'One step from rest: position moves by the NEW velocity × dt (1/36) — semi-implicit Euler',
    hint: 'Update velocity FIRST, then `position += newVelocity * dt`. If your position is still 0 after one step, you used the old velocity (explicit Euler).',
  });

  ctx.expect(original.position === 0 && original.velocity === 0, {
    message: 'The input state is not mutated',
    hint: 'Return a new object — do not write to `state.position` or `state.velocity`.',
    actual: `original is now { position: ${original.position}, velocity: ${original.velocity} }`,
    expected: '{ position: 0, velocity: 0 }',
  });

  const settled = simulate(springStep, { target: 1, stiffness: 170, damping: 26, mass: 1 }, STEP_COUNT);
  ctx.expect(settled !== null, {
    message: 'Repeated stepping keeps returning valid states',
    hint: 'Every call must return `{ position, velocity }` with finite numbers.',
  });
  if (settled === null) return;
  ctx.expectClose(settled.final.position, 1, 1e-3, {
    message: 'A stiffness 170 / damping 26 spring converges on its target',
    hint: 'Check the signs: the spring force must point TOWARD the target (`-stiffness * (position - target)`).',
  });
  ctx.expect(Math.abs(settled.final.velocity) < 1e-3, {
    message: 'The settled spring is at rest, not orbiting the target',
    hint: 'Damping must oppose velocity: `-damping * velocity`. A sign flip here adds energy every step.',
    actual: `velocity ${settled.final.velocity} after ${STEP_COUNT} steps`,
    expected: 'a velocity within ±0.001 of 0',
  });

  const underdamped = simulate(springStep, { target: 1, stiffness: 170, damping: 8, mass: 1 }, STEP_COUNT);
  ctx.expect(underdamped !== null && underdamped.maxPosition > 1.05, {
    message: 'With damping 8 the spring overshoots its target before settling',
    hint: 'Underdamped springs cross the target — if yours creeps up and stops, damping is being applied to position instead of velocity, or the integration order is wrong.',
    actual: underdamped === null ? 'stepping failed' : `peak position ${underdamped.maxPosition.toFixed(4)}`,
    expected: 'a peak above 1.05',
  });
}
```

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. Rule 6 for both: the `lerp` starter fails on `lerp(0, 10, 1)` (returns 0) and most of the rest; the `spring-step` starter fails from the first single-step assertion (velocity stays 0). Both failures are hinted.

- [ ] **Step 5: Mutation checks**

1. In `spring-step.ts`, temporarily swap the SOLUTION's two integration lines (position first, from the old velocity — explicit Euler). Run `pnpm test:catalog`. Expected: rule 5 FAILS on the "position moves by the NEW velocity" assertion (position 0 after one step) while the velocity assertion still passes — the single-step pair discriminates integration order exactly as the goal promises. Restore.
2. In `spring-step.ts`, temporarily flip the damping sign in the SOLUTION (`+config.damping * state.velocity`). Expected: rule 5 FAILS on the convergence and at-rest assertions (energy is added every step). Restore.
3. In `lerp.ts`, temporarily clamp the SOLUTION's `lerp` (`const clamped = Math.min(Math.max(t, 0), 1);`). Expected: rule 5 FAILS on the extrapolation assertion — the no-clamping goal is enforced, not decorative. Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read both `goals` arrays against the graders and the reference solutions (the exact constants — 1/36, 5/3, 170/26, 170/8 — appear in both the goals and the assertions). Confirm every goal is literally true of its solution.

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/easing-math src/challenges/spring-physics
git commit -m "feat(challenges): pure typescript module lane with lerp and spring-step"
```

---
## Task 5: Tailwind — utility transitions and a `@theme` animation token

**Files:**
- Create: `src/challenges/tailwind-basics/hover-transition.ts`, `src/challenges/tailwind-basics/hover-transition.grade.ts`, `src/challenges/tailwind-custom/theme-pulse.ts`, `src/challenges/tailwind-custom/theme-pulse.grade.ts`

**Interfaces:**
- Consumes: `Challenge`, `GradeContext` (`query`, `animations`, `timingOf`, `computed`, `matrix`, `hover`, `source`, `hasKeyframesRule`, `expect`, `expectClose`, `time.seek`), `pxNumber` from `@/sandbox/grader-utils`. Sandbox behaviour (Plan 02): when `tech` includes `'tailwind'`, css files are injected as `type="text/tailwindcss"`, `@tailwindcss/browser` JIT-compiles them, the mount awaits a unique-probe compile pass, and the hover rewrite re-applies after each compile so JIT-generated `hover:` rules are simulatable.
- Produces: the slice's Tailwind coverage. `tailwind-custom/theme-pulse` is **the pressure test for Plan 02's open question 2**: its grader passes only if the in-iframe JIT actually compiled a `@theme` token into a keyframes rule and a running animation — styled state that cannot exist pre-JIT. Also produces the geometry-based movement-reading convention (`getBoundingClientRect` deltas) that Plan 06 uses for every Tailwind challenge.

**Why Tailwind graders read geometry, not `ctx.matrix`.** Tailwind v4 may implement `translate-*`/`scale-*` utilities via the individual CSS properties (`translate`, `scale`) rather than `transform`. `ctx.matrix` parses only the computed `transform`, so it can read `none` while the element is visibly displaced. `getBoundingClientRect()` reflects the composite of all of them. Rule for this task and for Plan 06: **Tailwind movement is asserted through bounding-rect deltas; the transition itself is asserted through `CSSTransition.transitionProperty` membership in the transform family (`transform`, `translate`, `scale`, `rotate`).**

- [ ] **Step 1: Write the two challenge modules**

Create `src/challenges/tailwind-basics/hover-transition.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'tailwind-basics/hover-transition',
  title: 'Hover transition utilities',
  categoryId: 'tailwind-basics',
  difficulty: 'novice',
  tech: ['tailwind', 'css'],
  runtime: 'dom',
  estimatedMinutes: 6,
  tags: ['tailwind', 'transition', 'hover', 'utilities'],
  brief: [
    'The same hover lift you may have built in raw CSS — this time speaking Tailwind.',
    '',
    'Make the card rise 6px on hover with a smooth 300ms ease-out transition, using only utility',
    'classes in the markup: `transition-transform`, `duration-300`, `ease-out`, and a `hover:`',
    'translate variant.',
  ].join('\n'),
  goals: [
    'Hovering lifts the card 6px (`hover:-translate-y-1.5`), and the movement animates rather than teleporting.',
    'The transition targets the transform utilities specifically (`transition-transform`) — never `transition-all`.',
    'It runs for 300ms with the decelerating `ease-out` curve.',
  ],
  starter: {
    'index.html': [
      '<button type="button" class="card rounded-xl bg-white px-6 py-4 font-medium shadow">',
      '  Hover me',
      '</button>',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': [
      '<button',
      '  type="button"',
      '  class="card rounded-xl bg-white px-6 py-4 font-medium shadow transition-transform duration-300 ease-out hover:-translate-y-1.5"',
      '>',
      '  Hover me',
      '</button>',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'Four utilities carry the whole behaviour. `hover:-translate-y-1.5` is the state change (−6px:',
    'Tailwind spacing is a 4px scale, so 1.5 × 4 = 6). `transition-transform` opts the transform',
    'family into transitioning; `duration-300` and `ease-out` shape it. Remove any one and you get a',
    'teleport, a wrong speed, or a linear feel.',
    '',
    '### Why `transition-transform`, not `transition-all`',
    '',
    'Same reasoning as the raw-CSS version (`css-transitions/hover-lift`): `transition-all` animates',
    'every property that ever changes on the element — including ones a later utility adds by',
    'accident. Naming the family keeps the transition intentional and cheap.',
    '',
    '### What Tailwind actually emits',
    '',
    'There is no magic: each utility compiles to one declaration — `transition-property`,',
    '`transition-duration`, `transition-timing-function`, and a translate on the `:hover` variant.',
    'Open devtools and read the generated rules; the CSS challenge and this one produce near-identical',
    'computed styles. Tailwind is a notation for the same engine.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'The state change is a variant: `hover:-translate-y-1.5` (negative = up; 1.5 steps × 4px = 6px).',
    'A state change without `transition-transform` teleports — the transition utilities live on the resting element.',
    'Speed and feel are `duration-300` and `ease-out`.',
  ],
  relatedIds: ['css-transitions/hover-lift'],
};
```

Create `src/challenges/tailwind-custom/theme-pulse.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'tailwind-custom/theme-pulse',
  title: 'A @theme animation token',
  categoryId: 'tailwind-custom',
  difficulty: 'intermediate',
  tech: ['tailwind', 'css'],
  runtime: 'dom',
  estimatedMinutes: 12,
  tags: ['tailwind', 'theme', 'keyframes', 'design-tokens'],
  brief: [
    'The markup already asks for `animate-pulse-ring` — but Tailwind v4 only generates an',
    '`animate-*` utility when a matching `--animate-*` token exists in the theme.',
    '',
    'In `theme.css`, declare a `@theme` block with an `--animate-pulse-ring` token — value',
    '`pulse-ring 1200ms ease-in-out infinite` — and define the `pulse-ring` keyframes inside the same',
    '`@theme` block: at 0% and 100% the dot is normal; at 50% it is scaled to 1.25 with opacity 0.6.',
  ].join('\n'),
  goals: [
    'A `@theme` block declares `--animate-pulse-ring`, so Tailwind generates both the `animate-pulse-ring` utility and its `pulse-ring` keyframes.',
    'The dot pulses forever: 1200ms per cycle with `ease-in-out`.',
    'At the midpoint of each cycle the dot reaches 1.25× scale and 0.6 opacity, and it is back to normal at the cycle boundary.',
  ],
  starter: {
    'index.html': '<div class="dot animate-pulse-ring size-6 rounded-full bg-sky-500" aria-hidden="true"></div>\n',
    'theme.css': [
      '/* Declare the --animate-pulse-ring token (and its keyframes) inside a @theme block. */',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<div class="dot animate-pulse-ring size-6 rounded-full bg-sky-500" aria-hidden="true"></div>\n',
    'theme.css': [
      '@theme {',
      '  --animate-pulse-ring: pulse-ring 1200ms ease-in-out infinite;',
      '',
      '  @keyframes pulse-ring {',
      '    0%,',
      '    100% {',
      '      transform: scale(1);',
      '      opacity: 1;',
      '    }',
      '',
      '    50% {',
      '      transform: scale(1.25);',
      '      opacity: 0.6;',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'Tailwind v4 has no JS config: the theme IS CSS. A `--animate-<name>` token inside `@theme` does',
    'two things at once — it defines the design token, and it teaches the compiler to generate an',
    '`animate-<name>` utility whose value is the token. Keyframes declared inside `@theme` ride along:',
    'they are emitted into the output only when some utility actually references them, which is why',
    'the starter — same markup, no token — renders a motionless dot.',
    '',
    '### Token first, utility second',
    '',
    'The failure mode this challenge teaches: writing `animate-pulse-ring` in markup and expecting it',
    'to work. Utilities are *generated from* theme tokens; an unknown `animate-*` class compiles to',
    'nothing at all (not even an error). When an animation utility does nothing, check the theme.',
    '',
    '### Why keyframes live in the theme here',
    '',
    'They could sit at top level of the stylesheet — but inside `@theme` they are tree-shaken with the',
    'token and shared by anything else that references `--animate-pulse-ring`, which is exactly how a',
    'design system wants animation tokens to behave.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'The shape is `@theme { --animate-pulse-ring: pulse-ring 1200ms ease-in-out infinite; }` — the value is a full `animation` shorthand.',
    'Define `@keyframes pulse-ring` INSIDE the same `@theme` block; group `0%, 100%` for the resting frames.',
    'If the dot still does not move, the token name and the utility must match exactly: `--animate-pulse-ring` ↔ `animate-pulse-ring`.',
  ],
  relatedIds: ['tailwind-basics/hover-transition'],
};
```

- [ ] **Step 2: Watch the catalog gate demand the graders**

Run: `pnpm test:catalog`
Expected: FAIL — both new challenges fail the grader-file rule (and rule 5, via the `no grader is registered` throw). Rule 3 passes (html + css file sets, `dom` runtime, no entry needed).

- [ ] **Step 3: Write the two graders**

`tailwind-basics/hover-transition` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — hover lifts 6px, animated | a `CSSTransition` on a transform-family property starts on hover; rect-top delta ≈ −6 at the transition's end; delta strictly between at its midpoint |
| 2 — transform family, never `all` | computed `transition-property` list excludes `all` and includes a transform-family property |
| 3 — 300ms, ease-out | `timingOf(transition).duration === 300`; computed `transition-timing-function` is `ease-out`/`cubic-bezier(0, 0, 0.2, 1)` |

Create `src/challenges/tailwind-basics/hover-transition.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

const TRANSFORM_FAMILY = ['transform', 'translate', 'scale', 'rotate'];
const LIFT_PX = -6;

function transitionPropertyOf(animation: Animation): string | null {
  return animation instanceof CSSTransition ? animation.transitionProperty : null;
}

/**
 * Grades `tailwind-basics/hover-transition`. Movement is read through getBoundingClientRect deltas,
 * not `ctx.matrix`: Tailwind v4 may emit the individual `translate` property rather than
 * `transform`, and the rect reflects the composite of both. The transition itself is identified by
 * `CSSTransition.transitionProperty` membership in the transform family.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const card = ctx.query('.card');
  if (card === null) {
    throw new Error('the grader needs the `.card` element from the starter markup — keep the class name');
  }

  const restingTop = card.getBoundingClientRect().top;

  const properties = ctx
    .computed(card, 'transition-property')
    .split(',')
    .map((part) => part.trim());
  ctx.expect(!properties.includes('all'), {
    message: 'The transitioned properties are named — `transition-all` is not used',
    hint: 'Use `transition-transform`: `transition-all` animates every property that ever changes.',
    actual: properties.join(', '),
    expected: 'a list without `all`',
  });
  ctx.expect(properties.some((property) => TRANSFORM_FAMILY.includes(property)), {
    message: 'The transform family is opted into transitioning',
    hint: 'Add `transition-transform` to the card so the hover translate animates.',
    actual: properties.join(', '),
    expected: 'a list containing transform/translate/scale/rotate',
  });

  await ctx.hover(card);

  const transition =
    ctx
      .animations(card)
      .find((candidate) => {
        const property = transitionPropertyOf(candidate);
        return property !== null && TRANSFORM_FAMILY.includes(property);
      }) ?? null;
  ctx.expect(transition !== null, {
    message: 'Hovering starts a real transition on the transform family',
    hint: 'Three utilities together: `transition-transform duration-300 ease-out` on the card, plus `hover:-translate-y-1.5`.',
    actual: ctx.animations(card).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform/translate/scale/rotate',
  });
  if (transition === null) return;

  const duration = ctx.timingOf(transition).duration;
  ctx.expect(duration === 300, {
    message: 'The transition runs for 300ms',
    hint: 'That is the `duration-300` utility.',
    actual: duration,
    expected: 300,
  });

  const timingFunction = ctx.computed(card, 'transition-timing-function').replaceAll(' ', '');
  ctx.expect(timingFunction === 'ease-out' || timingFunction.startsWith('cubic-bezier(0,0,0.2,1)'), {
    message: 'The curve is `ease-out` — fast start, gentle landing',
    hint: 'Add the `ease-out` utility next to `duration-300`.',
    actual: timingFunction,
    expected: 'ease-out (cubic-bezier(0, 0, 0.2, 1))',
  });

  await ctx.time.seek(150);
  const midDelta = card.getBoundingClientRect().top - restingTop;
  ctx.expect(midDelta < -0.1 && midDelta > -5.9, {
    message: 'Half-way through, the card is between its two states — animating, not teleporting',
    hint: 'If the card is already fully lifted at 150ms, the transition utilities are missing and the translate applied instantly.',
    actual: `${midDelta.toFixed(2)}px at 150ms`,
    expected: 'strictly between 0 and -6px',
  });

  await ctx.time.seek(300);
  const endDelta = card.getBoundingClientRect().top - restingTop;
  ctx.expectClose(endDelta, LIFT_PX, 0.5, {
    message: 'The hover state lifts the card by exactly 6px',
    hint: '`hover:-translate-y-1.5` — 1.5 spacing steps × 4px = 6px, negative for up.',
  });
}
```

`tailwind-custom/theme-pulse` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — `@theme` token generates utility + keyframes | `source('theme.css')` contains `@theme` and `--animate-pulse-ring` (the challenge is explicitly about authoring the token); `hasKeyframesRule('pulse-ring')` — **exists only post-JIT**; a `CSSAnimation` named `pulse-ring` runs on the dot |
| 2 — forever, 1200ms, ease-in-out | `timingOf`: duration 1200, `iterations === Infinity`; computed `animation-timing-function` is `ease-in-out` |
| 3 — midpoint 1.25×/0.6, normal at boundary | at `seek(600)`: scale ≈ 1.25, opacity ≈ 0.6; at `seek(0)`: scale ≈ 1, opacity ≈ 1 |

Create `src/challenges/tailwind-custom/theme-pulse.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const SCALE_EPSILON = 0.02;
const OPACITY_EPSILON = 0.02;

/**
 * Grades `tailwind-custom/theme-pulse` — and, deliberately, pressure-tests the sandbox's Tailwind
 * readiness path: every assertion below reads state that exists ONLY if `@tailwindcss/browser`
 * JIT-compiled the user's `@theme` token after injection (the keyframes rule, the running
 * animation, the animated computed styles). If the compile-wait were broken, the reference
 * solution itself would fail rule 5.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const dot = ctx.query('.dot');
  if (dot === null) {
    throw new Error('the grader needs the `.dot` element from the starter markup — keep the class name');
  }

  const themeSource = ctx.source('theme.css');
  ctx.expect(themeSource.includes('@theme') && themeSource.includes('--animate-pulse-ring'), {
    message: 'theme.css declares the `--animate-pulse-ring` token inside a `@theme` block',
    hint: 'The utility in the markup only exists once the theme token does: `@theme { --animate-pulse-ring: …; }`.',
  });

  ctx.expect(ctx.hasKeyframesRule('pulse-ring'), {
    message: 'Tailwind generated the `pulse-ring` keyframes from the theme',
    hint: 'Define `@keyframes pulse-ring` inside the `@theme` block; it is emitted when `animate-pulse-ring` uses it.',
  });

  const animation =
    ctx.animations(dot).find((candidate) => candidate instanceof CSSAnimation && candidate.animationName === 'pulse-ring') ??
    null;
  ctx.expect(animation !== null, {
    message: 'The dot is running the `pulse-ring` animation',
    hint: 'Token and utility must match exactly: `--animate-pulse-ring` generates `animate-pulse-ring`.',
    actual: ctx.animations(dot).length === 0 ? 'no animations on .dot' : 'animations with other names only',
    expected: 'a CSS animation named `pulse-ring`',
  });
  if (animation === null) return;

  const timing = ctx.timingOf(animation);
  ctx.expect(timing.duration === 1200, {
    message: 'One pulse cycle lasts 1200ms',
    hint: 'The duration lives in the token value: `pulse-ring 1200ms ease-in-out infinite`.',
    actual: timing.duration,
    expected: 1200,
  });
  ctx.expect(timing.iterations === Infinity, {
    message: 'The pulse repeats forever',
    hint: 'End the token value with `infinite`.',
    actual: timing.iterations,
    expected: 'Infinity',
  });
  ctx.expect(ctx.computed(dot, 'animation-timing-function') === 'ease-in-out', {
    message: 'The pulse eases in and out',
    hint: 'Put `ease-in-out` in the token value between the duration and `infinite`.',
    actual: ctx.computed(dot, 'animation-timing-function'),
    expected: 'ease-in-out',
  });

  await ctx.time.seek(600);
  ctx.expectClose(ctx.matrix(dot).a, 1.25, SCALE_EPSILON, {
    message: 'At the cycle midpoint the dot is scaled to 1.25',
    hint: 'The 50% keyframe is `transform: scale(1.25)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(dot, 'opacity')), 0.6, OPACITY_EPSILON, {
    message: 'At the cycle midpoint the dot fades to 0.6 opacity',
    hint: 'Put `opacity: 0.6` in the 50% keyframe alongside the scale.',
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(dot).a, 1, SCALE_EPSILON, {
    message: 'At the cycle boundary the dot is back to normal size',
    hint: 'Group the resting frames: `0%, 100% { transform: scale(1); opacity: 1; }`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(dot, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'At the cycle boundary the dot is fully opaque',
    hint: 'The 0%/100% frames end at `opacity: 1`.',
  });
}
```

The keyframes here set `transform: scale(…)` directly (not a Tailwind scale utility), so `ctx.matrix` is the right reader — the rect-delta rule above applies to *utility-driven* movement, not to hand-authored keyframe transforms.

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. Rule 5 on `theme-pulse` is the moment Plan 02's open question 2 is answered with real content: the solution passes only because the injected `@theme` css was JIT-compiled before grading. Rule 6: the `hover-transition` starter fails on the `transition-property` assertions (`all` is the browser default when no utility opts in) and on the movement assertions; the `theme-pulse` starter fails on the token/keyframes/animation assertions.

If rule 5 fails on `theme-pulse` with `hasKeyframesRule('pulse-ring')` false while the token assertion passes, the Tailwind compile-wait did not cover the injected theme — that is a Plan 02 harness regression, not a content bug. STOP and report it; do not weaken the grader.

- [ ] **Step 5: Mutation checks**

1. In `hover-transition.ts`, temporarily change the SOLUTION's class list to use `transition-all` instead of `transition-transform`. Run `pnpm test:catalog`. Expected: rule 5 FAILS on the "not `transition-all`" assertion — the goals-vs-solution contradiction class, machine-caught. Restore.
2. In `hover-transition.ts`, temporarily delete `duration-300 ease-out` from the SOLUTION. Expected: rule 5 FAILS on the duration assertion (Tailwind's default transition duration is 150ms) and the easing assertion. Restore.
3. In `theme-pulse.ts`, temporarily rename the SOLUTION's token to `--animate-pulse-rings` (utility no longer matches). Expected: rule 5 FAILS on the running-animation assertion — proving the grader detects a token/utility mismatch, the challenge's core failure mode. Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read both `goals` arrays against the graders and solutions. Note goal 1 of `hover-transition` names the exact utility (`hover:-translate-y-1.5`) — confirm the solution uses exactly that class, since goals are shown verbatim to the user.

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/tailwind-basics src/challenges/tailwind-custom
git commit -m "feat(challenges): tailwind utility and @theme animation challenges"
```

---
## Task 6: JavaScript motion — a first rAF loop and motion's `animate()`

**Files:**
- Create: `src/challenges/raf-tweening/first-loop.ts`, `src/challenges/raf-tweening/first-loop.grade.ts`, `src/challenges/motion-core/first-animate.ts`, `src/challenges/motion-core/first-animate.grade.ts`

**Interfaces:**
- Consumes: `Challenge`, `GradeContext` (`query`, `animations`, `timingOf`, `computed`, `matrix`, `expect`, `expectClose`, `time.stepFrames`, `time.seek`, `time.settle`), nothing new from grader-utils (no sampling loop here — fixed step counts). Sandbox import map provides `motion` for user code. **TimeController contract (binding):** `stepFrames(n)` yields exactly n × (1000/60) ms of motion — 15 frames of a 500ms tween is 250ms, half-way. Loops started at mount observe this exactly; the baseline off-by-one is compensated inside Plan 02's implementation.
- Produces: the rAF-arithmetic grader pattern (exact n-frame reads at 15/30 frames) and the motion-vanilla WAAPI-introspection pattern, both Plan 06 templates.

- [ ] **Step 1: Write the two challenge modules**

Create `src/challenges/raf-tweening/first-loop.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'raf-tweening/first-loop',
  title: 'A first rAF loop',
  categoryId: 'raf-tweening',
  difficulty: 'novice',
  tech: ['ts'],
  runtime: 'dom',
  estimatedMinutes: 12,
  tags: ['raf', 'tween', 'game-loop', 'transform'],
  brief: [
    'No CSS transitions, no animation libraries: move the box yourself, one frame at a time.',
    '',
    'In index.ts, drive the box from `translateX(0)` to `translateX(300px)` over 500ms with a',
    '`requestAnimationFrame` loop. Compute progress from the timestamp rAF hands you, clamp it at 1,',
    'write the transform, and stop requesting frames when the tween is done.',
  ].join('\n'),
  goals: [
    'Driven by `requestAnimationFrame`, the box slides from 0 to 300px over 500ms — no CSS transition or animation is involved.',
    'Half-way — 15 frames at 60Hz, 250ms — the box sits at exactly 150px.',
    'The loop clamps progress at 1 and stops: after finishing, the box rests at exactly 300px and stays there.',
    'The movement writes `transform`, never `left`.',
  ],
  starter: {
    'index.html': '<div class="box" aria-hidden="true"></div>\n',
    'styles.css': [
      '.box {',
      '  width: 48px;',
      '  height: 48px;',
      '  border-radius: 8px;',
      '  background: #f97316;',
      '}',
      '',
    ].join('\n'),
    'index.ts': [
      "const box = document.querySelector<HTMLElement>('.box');",
      '',
      '// Drive box.style.transform from translateX(0) to translateX(300px) over 500ms',
      '// with a requestAnimationFrame loop.',
      'void box;',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<div class="box" aria-hidden="true"></div>\n',
    'styles.css': [
      '.box {',
      '  width: 48px;',
      '  height: 48px;',
      '  border-radius: 8px;',
      '  background: #f97316;',
      '}',
      '',
    ].join('\n'),
    'index.ts': [
      "const box = document.querySelector<HTMLElement>('.box');",
      'const DURATION_MS = 500;',
      'const DISTANCE_PX = 300;',
      '',
      'let start: number | null = null;',
      '',
      'function frame(now: number): void {',
      '  if (start === null) start = now;',
      '  const progress = Math.min((now - start) / DURATION_MS, 1);',
      '  if (box) box.style.transform = `translateX(${progress * DISTANCE_PX}px)`;',
      '  if (progress < 1) requestAnimationFrame(frame);',
      '}',
      '',
      'requestAnimationFrame(frame);',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'A tween is three numbers: when it started, how long it lasts, and how far it goes. rAF hands the',
    'loop a timestamp each frame; `(now - start) / DURATION_MS` turns elapsed time into progress 0→1,',
    'and progress times distance is the transform. The first callback only learns the start time —',
    'which is why `start` is captured from the timestamp, never from `Date.now()` outside the loop.',
    '',
    '### The two lines everyone forgets',
    '',
    '`Math.min(progress, 1)` and `if (progress < 1)`. Without the clamp, the last frame overshoots',
    '(frames land ~16.7ms apart, not exactly on 500); without the stop condition the loop runs',
    'forever, burning a frame callback per frame for an animation that finished. Clamp, write the',
    'final value once, stop asking for frames.',
    '',
    '### Why `transform`',
    '',
    'Writing `left` forces layout every frame — the whole page reflows 60 times a second. Writing',
    '`transform` stays on the compositor. Same rule as every CSS challenge in this catalog, and it',
    'matters *more* here because JS-driven movement already competes with everything else on the main',
    'thread.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Skeleton: `function frame(now) { … requestAnimationFrame(frame); } requestAnimationFrame(frame);`',
    'Capture the start from the FIRST timestamp: `if (start === null) start = now;` — then progress is `(now - start) / 500`.',
    'Clamp with `Math.min(progress, 1)`, and only re-request a frame `if (progress < 1)`.',
  ],
  relatedIds: ['easing-math/lerp'],
};
```

Create `src/challenges/motion-core/first-animate.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'motion-core/first-animate',
  title: 'animate() an element',
  categoryId: 'motion-core',
  difficulty: 'novice',
  tech: ['motion', 'ts'],
  runtime: 'dom',
  estimatedMinutes: 6,
  tags: ['motion', 'animate', 'waapi', 'vanilla'],
  brief: [
    "One import, one call: use motion's `animate()` to slide the box 240px to the right.",
    '',
    'Duration 1.2 seconds (motion counts in seconds, not milliseconds), `easeOut` easing. Compare the',
    'ergonomics with the rAF loop you may have hand-written in `raf-tweening/first-loop` — this is',
    'the same tween, delegated.',
  ].join('\n'),
  goals: [
    "The box is animated by motion's `animate()`, which drives a real Web Animation — it starts at 0 and lands exactly on `translateX(240px)`.",
    'The effect runs 1.2 seconds and eases out: at half time the box is already well past half distance.',
    'The end state sticks — after the animation the box rests at 240px.',
  ],
  starter: {
    'index.html': '<div class="box" aria-hidden="true"></div>\n',
    'styles.css': [
      '.box {',
      '  width: 48px;',
      '  height: 48px;',
      '  border-radius: 8px;',
      '  background: #14b8a6;',
      '}',
      '',
    ].join('\n'),
    'index.ts': [
      "// import { animate } from 'motion' and slide .box 240px right over 1.2s, easing out.",
      'export {};',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<div class="box" aria-hidden="true"></div>\n',
    'styles.css': [
      '.box {',
      '  width: 48px;',
      '  height: 48px;',
      '  border-radius: 8px;',
      '  background: #14b8a6;',
      '}',
      '',
    ].join('\n'),
    'index.ts': [
      "import { animate } from 'motion';",
      '',
      "animate('.box', { transform: 'translateX(240px)' }, { duration: 1.2, ease: 'easeOut' });",
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    "motion's vanilla `animate()` takes a target (an element, or a selector it resolves for you),",
    'the values to animate to, and options. For transform values it hands the work to the Web',
    'Animations API — the browser runs the animation off the main thread where it can — and returns',
    'playback controls. Compare `raf-tweening/first-loop`: the loop, the clamp, the stop condition,',
    'the easing math — all of it is this one call.',
    '',
    '### Seconds, not milliseconds',
    '',
    'motion counts time in seconds (`duration: 1.2`), unlike CSS and WAAPI (milliseconds). Mixing the',
    'two conventions is the most common first bug when adopting motion — a `duration: 300` tween',
    'lasts five minutes.',
    '',
    '### What "delegated" buys you',
    '',
    'Because the underlying animation is a real WAAPI object, devtools sees it, `document',
    '.getAnimations()` lists it, and it keeps running while the main thread is busy. A hand-rolled',
    'rAF loop gets none of that for free — which is why the later challenges in this category are',
    "about motion's sequencing and controls, not about reimplementing tweens.",
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    "The import is `import { animate } from 'motion';` — the sandbox resolves `motion` for you.",
    "`animate('.box', { transform: 'translateX(240px)' }, { … })` — a selector string works as the target.",
    "Options: `{ duration: 1.2, ease: 'easeOut' }`. Seconds! `duration: 1200` would run for 20 minutes.",
  ],
  relatedIds: ['raf-tweening/first-loop', 'waapi/bounce-in'],
};
```

- [ ] **Step 2: Watch the catalog gate demand the graders**

Run: `pnpm test:catalog`
Expected: FAIL — both new challenges fail the grader-file rule (and rule 5, via the `no grader is registered` throw); rule 3 green.

- [ ] **Step 3: Write the two graders**

`raf-tweening/first-loop` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — rAF-driven, 0→300 over 500ms, no CSS animation | `animations(box).length === 0` (inline-style writes create no Animation objects); start at 0; mid and end reads below |
| 2 — exactly 150px at 15 frames | after `stepFrames(15)`: `matrix().e ≈ 150` |
| 3 — clamps and stops at exactly 300px | after 15 more frames (30 total = 500ms): `matrix().e ≈ 300`; after 5 further frames: still ≈ 300 |
| 4 — `transform`, never `left` | computed `left` is `auto` after the tween |

The 15/30-frame arithmetic is exact by construction: `frameMs = 1000/60`, so 15 frames = 250ms and 30 frames = 500ms precisely, and a linear 500ms/300px tween reads 150 and 300. **This grader is written against `stepFrames(n)` = n frames of motion — if it reads ≈140px at step 15, the TimeController's baseline compensation regressed; report it, do not re-tune the grader to n − 1.**

Create `src/challenges/raf-tweening/first-loop.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 2;

/**
 * Grades `raf-tweening/first-loop` with exact frame arithmetic: 15 virtual frames = 250ms = 150px
 * of a linear 500ms/300px tween; 30 frames = 500ms = 300px. `stepFrames(n)` yields exactly n
 * frames of motion (the baseline off-by-one is compensated inside the TimeController).
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const box = ctx.query('.box');
  if (box === null) {
    throw new Error('the grader needs the `.box` element from the starter markup — keep the class name');
  }

  ctx.expect(ctx.animations(box).length === 0, {
    message: 'No CSS transition or animation is involved — the movement is hand-driven',
    hint: 'Write `box.style.transform` from a requestAnimationFrame loop; do not reach for CSS animations here.',
    actual: `${ctx.animations(box).length} animation object(s) on .box`,
    expected: 'none',
  });

  ctx.expectClose(ctx.matrix(box).e, 0, POSITION_EPSILON_PX, {
    message: 'Before any frame the box is at its start',
    hint: 'The loop moves the box from translateX(0) — do not pre-position it.',
  });

  await ctx.time.stepFrames(15);
  ctx.expectClose(ctx.matrix(box).e, 150, POSITION_EPSILON_PX, {
    message: 'After 15 frames (250ms) the box sits at exactly 150px — half-way',
    hint: 'Progress is `(now - start) / 500`, with `start` captured from the FIRST rAF timestamp. If you are near 150 but drifting, you are mixing Date.now() with the rAF timestamp.',
  });

  await ctx.time.stepFrames(15);
  ctx.expectClose(ctx.matrix(box).e, 300, POSITION_EPSILON_PX, {
    message: 'After 30 frames (500ms) the box has arrived at exactly 300px',
    hint: 'Clamp progress with `Math.min(progress, 1)` so the final write lands exactly on 300px.',
  });

  await ctx.time.stepFrames(5);
  ctx.expectClose(ctx.matrix(box).e, 300, POSITION_EPSILON_PX, {
    message: 'The finished tween stays put — the loop stopped',
    hint: 'Only re-request a frame while `progress < 1`; a loop that keeps running keeps writing.',
  });

  ctx.expect(ctx.computed(box, 'left') === 'auto', {
    message: 'The movement comes from `transform`, not `left`',
    hint: 'Animating `left` re-runs layout every frame; write `transform: translateX(…)` instead.',
    actual: `left: ${ctx.computed(box, 'left')}`,
    expected: 'left: auto',
  });
}
```

`motion-core/first-animate` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — motion `animate()` drives a real Web Animation, 0→240 | an animation on `.box` that is neither `CSSAnimation` nor `CSSTransition`; at `seek(0)`: e ≈ 0; end read below |
| 2 — 1.2s, eases out | `timingOf(...).duration === 1200`; at `seek(600)`: 150 < e < 239 (well past half distance, not yet done) |
| 3 — end state sticks | after `settle()`: e ≈ 240 |

Create `src/challenges/motion-core/first-animate.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 1;

/**
 * Grades `motion-core/first-animate`. motion's vanilla `animate()` drives transform values through
 * WAAPI, so the grader introspects the animation object and scrubs it deterministically with
 * `seek`. If rule 5 ever fails here with "no Web Animation on .box" for the reference solution,
 * the installed motion version stopped using WAAPI for transform strings — report it to the
 * coordinator rather than rewriting the goal.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const box = ctx.query('.box');
  if (box === null) {
    throw new Error('the grader needs the `.box` element from the starter markup — keep the class name');
  }

  const animation =
    ctx
      .animations(box)
      .find((candidate) => !(candidate instanceof CSSAnimation) && !(candidate instanceof CSSTransition)) ?? null;
  ctx.expect(animation !== null, {
    message: "motion's animate() is driving a real Web Animation on the box",
    hint: "Import `{ animate }` from 'motion' and call `animate('.box', { transform: 'translateX(240px)' }, options)`.",
    actual: ctx.animations(box).length === 0 ? 'no animations on .box' : 'only CSS-declared animations',
    expected: 'a script-created Web Animation',
  });
  if (animation === null) return;

  ctx.expect(ctx.timingOf(animation).duration === 1200, {
    message: 'The effect runs for 1.2 seconds',
    hint: 'motion counts in seconds: `duration: 1.2`. If your animation lasts 20 minutes, you passed milliseconds.',
    actual: ctx.timingOf(animation).duration,
    expected: 1200,
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(box).e, 0, POSITION_EPSILON_PX, {
    message: 'The slide starts from the resting position',
    hint: 'Animate TO translateX(240px); the starting state is where the box already is.',
  });

  await ctx.time.seek(600);
  const midway = ctx.matrix(box).e;
  ctx.expect(midway > 150 && midway < 239, {
    message: 'At half time the box is well past half distance — the ease-out curve front-loads speed',
    hint: "Pass `ease: 'easeOut'` in the options. Linear easing would read exactly 120px here.",
    actual: `${midway.toFixed(1)}px at 600ms`,
    expected: 'more than 150px, less than 239px',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(box).e, 240, POSITION_EPSILON_PX, {
    message: 'The box lands exactly on translateX(240px) and stays there',
    hint: 'motion holds the final value for you — if the box snaps back, the animation was cancelled.',
  });
}
```

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. Rule 6: the `first-loop` starter fails on the 150px and 300px reads (the box never moves); the `first-animate` starter fails on the missing-animation assertion. All hinted.

- [ ] **Step 5: Mutation checks**

1. In `first-loop.ts`, temporarily break BOTH guards in the SOLUTION at once: remove `Math.min(…, 1)` (use raw progress) AND change `if (progress < 1) requestAnimationFrame(frame);` to re-request unconditionally. Run `pnpm test:catalog`. Expected: rule 5 FAILS on the 5-extra-frame "stays put" read, which now deterministically reads ≈350px (35 frames ≈ 583ms → raw progress ≈ 1.167 × 300px). The arrival read at frame 30 still passes — accumulated `FRAME_MS` doubles land within the 2px epsilon of 300 — which is why removing the clamp alone is NOT a valid mutation: at frame 30 the raw progress is already ≥ 1 (the float sum sits marginally above 500ms), so the stop condition fires and everything stays green. Both guards together are what the "clamps and stops" goal asserts, and this paired mutation is what turns the stays-put assertion red. Restore both lines.
2. In `first-loop.ts`, temporarily change the SOLUTION to baseline with `const start = Date.now();` outside the loop instead of the rAF timestamp. Expected: rule 5 still PASSES — and that is correct, not a gap: the virtual clock patches `Date.now` to the same timeline precisely so both baselining styles observe identical time (Plan 02 Task 8). Note this in the commit message if it surprises you; restore anyway.
3. In `first-animate.ts`, temporarily change the SOLUTION's options to `{ duration: 1.2, ease: 'linear' }`. Expected: rule 5 FAILS on the half-time assertion (reads ≈120px) — the easing goal is genuinely checked. Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read both `goals` arrays against graders and solutions. Goal 2 of `first-loop` states the exact frame arithmetic ("15 frames at 60Hz, 250ms … exactly 150px") — confirm the grader's numbers match it literally.

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/raf-tweening src/challenges/motion-core
git commit -m "feat(challenges): raf tween loop and motion animate challenges"
```

---
## Task 7: Easing curves and the 3D card flip

**Files:**
- Create: `src/challenges/easing-timing/overshoot-bezier.ts`, `src/challenges/easing-timing/overshoot-bezier.grade.ts`, `src/challenges/easing-timing/snappy-ease.ts` (**rubric — deliberately no grader file**), `src/challenges/transforms-3d/card-flip.ts`, `src/challenges/transforms-3d/card-flip.grade.ts`

**Interfaces:**
- Consumes: `Challenge`, `GradeContext` (`query`, `animations`, `timingOf`, `computed`, `matrix`, `hover`, `expect`, `expectClose`, `time.seek`), `pxNumber` from `@/sandbox/grader-utils`. Hover simulation (Plan 02 Task 9): `:hover` selectors — including in descendant selectors like `.scene:hover .card` — are rewritten at mount so `ctx.hover` genuinely triggers them.
- Produces: the slice's `rubric` challenge (`easing-timing/snappy-ease` — the first registry entry with a `rubric` array and **no grader**, exercising the catalog gate's rubric branch: rule 3 plus the must-NOT-have-a-grader check), the second series with authored members (`card-flip`, 1 of 3), and two grader patterns for Plan 06: sampling a transition at several seek times to detect easing overshoot, and reading 3D rotation through `DOMMatrix.m11`.

- [ ] **Step 1: Write the three challenge modules**

Create `src/challenges/easing-timing/overshoot-bezier.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'easing-timing/overshoot-bezier',
  title: 'Overshoot from a cubic-bezier',
  categoryId: 'easing-timing',
  difficulty: 'intermediate',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 10,
  tags: ['easing', 'cubic-bezier', 'overshoot', 'transition'],
  brief: [
    'The chip already slides on hover — but it lands flat. Make it overshoot.',
    '',
    'Keep the single transition (160px over 400ms), and replace `ease` with a `cubic-bezier()` whose',
    'output control values push above 1 — for example `cubic-bezier(0.34, 1.56, 0.64, 1)`. The chip',
    'should travel past its destination and settle back, with no keyframes involved.',
  ].join('\n'),
  goals: [
    'Hovering slides the chip 160px right over 400ms, landing exactly on target.',
    'Mid-flight it travels past 160px and comes back — overshoot created purely by the transition easing, not extra keyframes.',
    'The timing function is a custom `cubic-bezier()` with at least one output (y) control value greater than 1.',
  ],
  starter: {
    'index.html': '<button type="button" class="chip">Slide</button>\n',
    'styles.css': [
      '.chip {',
      '  width: 120px;',
      '  padding: 12px 0;',
      '  text-align: center;',
      '  border: 0;',
      '  border-radius: 9999px;',
      '  background: #a78bfa;',
      '  font: 600 14px/1 system-ui, sans-serif;',
      '  transition: transform 400ms ease;',
      '}',
      '',
      '.chip:hover {',
      '  transform: translateX(160px);',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<button type="button" class="chip">Slide</button>\n',
    'styles.css': [
      '.chip {',
      '  width: 120px;',
      '  padding: 12px 0;',
      '  text-align: center;',
      '  border: 0;',
      '  border-radius: 9999px;',
      '  background: #a78bfa;',
      '  font: 600 14px/1 system-ui, sans-serif;',
      '  transition: transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1);',
      '}',
      '',
      '.chip:hover {',
      '  transform: translateX(160px);',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'A transition interpolates progress 0→1 through its timing function. Nothing forbids the curve',
    'from *leaving* that range: `cubic-bezier(0.34, 1.56, 0.64, 1)` has its first output control at',
    '1.56, so mid-transition the eased progress exceeds 1 — the chip is briefly past 160px — before',
    'the curve comes back down to land at exactly 1. The x control values must stay in [0, 1] (they',
    'are time), but the y values are free.',
    '',
    '### Overshoot without keyframes',
    '',
    'The keyframe version of this effect (see `css-keyframes/bounce-in`) hand-places a `scale(1.1)`',
    'frame. The easing version needs no extra state: it composes with ANY property change, reverses',
    'cleanly when the hover ends, and retargets smoothly when interrupted — because it is still just',
    'one transition.',
    '',
    '### Reading the curve',
    '',
    'In `cubic-bezier(x1, y1, x2, y2)`, y1 > 1 means "overshoot early, glide back"; y2 > 1 pushes the',
    'overshoot late. Values below 0 anticipate (pull back before launching). Tools like',
    'cubic-bezier.com let you drag the handles and watch — the reference value here is a mild 10%',
    'overshoot.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Only the timing function changes — the starter already has the right property, distance, and duration.',
    'In `cubic-bezier(x1, y1, x2, y2)` the two y values are the output curve: push one above 1.',
    'Try `cubic-bezier(0.34, 1.56, 0.64, 1)` and then tune: bigger y1, bigger bounce.',
  ],
  relatedIds: ['css-keyframes/bounce-in'],
};
```

Create `src/challenges/easing-timing/snappy-ease.ts` — the rubric challenge (no grader file will exist for it):

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'easing-timing/snappy-ease',
  title: 'A snappier ease',
  categoryId: 'easing-timing',
  difficulty: 'novice',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 5,
  tags: ['easing', 'cubic-bezier', 'feel'],
  brief: [
    'The chip lifts on hover with the default `ease` — serviceable, but sluggish: `ease` spends its',
    'first moments accelerating, so the response feels late.',
    '',
    'Replace `ease` with a `cubic-bezier()` you tune yourself so the response starts fast and',
    'decelerates into place. The reference uses `cubic-bezier(0.2, 0, 0, 1)` — a material-style',
    '"standard decelerate" — but this is a feel exercise: match the target side by side.',
  ].join('\n'),
  goals: [
    'The hover response starts fast: the curve front-loads velocity instead of easing in.',
    'It decelerates smoothly into the final state with no overshoot.',
    'The default `ease` keyword is replaced by an explicit `cubic-bezier()` tuned by hand.',
  ],
  starter: {
    'index.html': '<button type="button" class="chip">Save</button>\n',
    'styles.css': [
      '.chip {',
      '  padding: 12px 24px;',
      '  border: 0;',
      '  border-radius: 9999px;',
      '  background: #34d399;',
      '  font: 600 14px/1 system-ui, sans-serif;',
      '  transition: transform 250ms ease;',
      '}',
      '',
      '.chip:hover {',
      '  transform: translateY(-4px) scale(1.03);',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<button type="button" class="chip">Save</button>\n',
    'styles.css': [
      '.chip {',
      '  padding: 12px 24px;',
      '  border: 0;',
      '  border-radius: 9999px;',
      '  background: #34d399;',
      '  font: 600 14px/1 system-ui, sans-serif;',
      '  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1);',
      '}',
      '',
      '.chip:hover {',
      '  transform: translateY(-4px) scale(1.03);',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    '`cubic-bezier(0.2, 0, 0, 1)` reaches high velocity almost immediately (small x1, zero y1 means',
    'the curve leaves the origin steeply) and spends most of its 250ms decelerating (x2 of 0, y2 of 1',
    'flattens the approach). The default `ease` — `cubic-bezier(0.25, 0.1, 0.25, 1)` — accelerates',
    'first, which reads as a pause before the response.',
    '',
    '### Why this is graded by eye',
    '',
    '"Snappier" is a perceptual claim. A machine can verify that you changed the curve, but not that',
    'the result *feels* right — the difference between 0.2 and 0.35 for x1 is taste, context, and',
    'distance. This is what the rubric grade mode exists for (spec §2): run yours beside the target,',
    'hover both, and judge the first 100ms honestly.',
    '',
    '### A rule of thumb worth keeping',
    '',
    'Interfaces respond to the user; they do not wind up. Enter fast and land soft (decelerate) for',
    'responses to user intent; ease in only when something leaves on its own schedule.',
  ].join('\n'),
  gradeMode: 'rubric',
  rubric: [
    {
      id: 'starts-fast',
      label: 'The movement visibly starts faster than the starter version.',
      detail: 'Hover both panes together and watch the first 100ms — the tuned curve should already be moving.',
    },
    {
      id: 'no-overshoot',
      label: 'It settles without bouncing past its end position.',
    },
    {
      id: 'matches-target',
      label: 'Side by side with the target, both feel equally snappy.',
    },
  ],
  hints: [
    'Only the timing function changes — keep the property, distance, and 250ms duration.',
    'Front-load velocity with a small x1 and y1 (try 0.2 and 0); land soft with x2 near 0 and y2 at 1.',
    'Compare against the target with quick hover-in/hover-out flicks, not long stares.',
  ],
  relatedIds: ['easing-timing/overshoot-bezier'],
};
```

Create `src/challenges/transforms-3d/card-flip.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'transforms-3d/card-flip',
  title: 'Card flip',
  categoryId: 'transforms-3d',
  difficulty: 'novice',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 15,
  tags: ['3d', 'rotateY', 'backface-visibility', 'perspective'],
  brief: [
    'Two faces, one card. Right now they are stacked flat and the back sits on top.',
    '',
    'Make the card flip in 3D on hover: give the scene `perspective`, let the card',
    '`transform-style: preserve-3d`, pre-rotate the back face 180° with `backface-visibility: hidden`',
    'on both faces, and transition the card to `rotateY(180deg)` over roughly 600ms.',
  ].join('\n'),
  goals: [
    'Hovering the scene flips the card 180° around the Y axis with a transition of roughly 600ms.',
    'The flip happens in real 3D: the scene supplies `perspective`, and the card preserves 3D for its children.',
    'Each face hides its reverse side with `backface-visibility: hidden`, and the back face is pre-rotated 180° so it reads correctly when shown.',
  ],
  starter: {
    'index.html': [
      '<div class="scene">',
      '  <div class="card">',
      '    <div class="face front">Front</div>',
      '    <div class="face back">Back</div>',
      '  </div>',
      '</div>',
      '',
    ].join('\n'),
    'styles.css': [
      '.scene {',
      '  width: 180px;',
      '  height: 240px;',
      '}',
      '',
      '.card {',
      '  position: relative;',
      '  width: 100%;',
      '  height: 100%;',
      '}',
      '',
      '/* Flip .card to rotateY(180deg) when .scene is hovered. */',
      '',
      '.face {',
      '  position: absolute;',
      '  inset: 0;',
      '  display: grid;',
      '  place-items: center;',
      '  border-radius: 12px;',
      '  font: 600 18px/1 system-ui, sans-serif;',
      '  color: white;',
      '}',
      '',
      '.front {',
      '  background: #0ea5e9;',
      '}',
      '',
      '.back {',
      '  background: #8b5cf6;',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': [
      '<div class="scene">',
      '  <div class="card">',
      '    <div class="face front">Front</div>',
      '    <div class="face back">Back</div>',
      '  </div>',
      '</div>',
      '',
    ].join('\n'),
    'styles.css': [
      '.scene {',
      '  width: 180px;',
      '  height: 240px;',
      '  perspective: 800px;',
      '}',
      '',
      '.card {',
      '  position: relative;',
      '  width: 100%;',
      '  height: 100%;',
      '  transform-style: preserve-3d;',
      '  transition: transform 600ms ease;',
      '}',
      '',
      '.scene:hover .card {',
      '  transform: rotateY(180deg);',
      '}',
      '',
      '.face {',
      '  position: absolute;',
      '  inset: 0;',
      '  display: grid;',
      '  place-items: center;',
      '  border-radius: 12px;',
      '  backface-visibility: hidden;',
      '  font: 600 18px/1 system-ui, sans-serif;',
      '  color: white;',
      '}',
      '',
      '.front {',
      '  background: #0ea5e9;',
      '}',
      '',
      '.back {',
      '  background: #8b5cf6;',
      '  transform: rotateY(180deg);',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'Four declarations conspire. `perspective` on the *scene* creates the 3D viewpoint (on the parent,',
    'so the whole card shares one vanishing point). `transform-style: preserve-3d` on the *card* stops',
    'the browser flattening its children back to a plane — without it the faces rotate as a painted',
    'texture. `backface-visibility: hidden` makes each face vanish when it turns away, and pre-rotating',
    '`.back` by 180° means "away" for the back is exactly when the front shows, and vice versa.',
    '',
    '### The pre-rotation trick',
    '',
    'The back face is *always* rotated 180° — it never animates. What animates is the card, and the',
    'back simply becomes the face pointing at you once the card passes 90°. Forgetting the',
    'pre-rotation gives mirror-image text on the flipped card; forgetting `backface-visibility` shows',
    'the back through the front the whole time (the starter bug).',
    '',
    '### The series',
    '',
    'This flip returns twice: in pure Tailwind utilities (`tailwind-basics`, where the challenge is',
    'expressing these four declarations as classes) and in motion (`motion-react-basics`, where the',
    'rotation becomes animated state). Same geometry every time — master it here first.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Depth first: `perspective: 800px` on `.scene`, `transform-style: preserve-3d` on `.card`.',
    'The flip is one rule: `.scene:hover .card { transform: rotateY(180deg); }` plus a `transition` on `.card`.',
    'Faces: `backface-visibility: hidden` on `.face`, and `.back` also gets a permanent `transform: rotateY(180deg)`.',
  ],
  series: { id: 'card-flip', label: 'Card flip' },
  relatedIds: ['css-transitions/hover-lift'],
};
```

- [ ] **Step 2: Watch the catalog gate demand exactly two graders**

Run: `pnpm test:catalog`
Expected: FAIL — `easing-timing/overshoot-bezier (auto) has a grader` and `transforms-3d/card-flip (auto) has a grader` fail (their rule-5 entries also fail via the `no grader is registered` throw). **`easing-timing/snappy-ease (rubric) must NOT have a grader` passes** — the rubric branch of the grader-file rule is now exercised by real content for the first time, and `snappy-ease` correctly appears in no rule-5/6 suite at all. Rule 3 passes for all three.

- [ ] **Step 3: Write the two graders**

`easing-timing/overshoot-bezier` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — 160px over 400ms, lands on target | a transform `CSSTransition` starts on hover, duration 400; at `seek(400)`: e ≈ 160 |
| 2 — passes 160 and comes back, easing only | max of e at seeks 240/270/300/330 > 162; every animation on the chip is a `CSSTransition` (no keyframes-driven motion) |
| 3 — cubic-bezier with a y value > 1 | computed `transition-timing-function` parses as `cubic-bezier(x1, y1, x2, y2)` with y1 > 1 or y2 > 1 |

Create `src/challenges/easing-timing/overshoot-bezier.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 0.5;
const BEZIER_PATTERN = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/;

function transitionPropertyOf(animation: Animation): string | null {
  return animation instanceof CSSTransition ? animation.transitionProperty : null;
}

/**
 * Grades `easing-timing/overshoot-bezier`: a single hover transition whose cubic-bezier easing
 * carries the chip past 160px mid-flight and back to an exact landing. Overshoot is detected by
 * sampling the scrubbed transition at four times around the curve's peak.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const chip = ctx.query('.chip');
  if (chip === null) {
    throw new Error('the grader needs the `.chip` element from the starter markup — keep the class name');
  }

  await ctx.hover(chip);

  const transition =
    ctx.animations(chip).find((candidate) => transitionPropertyOf(candidate) === 'transform') ?? null;
  ctx.expect(transition !== null, {
    message: 'Hovering starts a transition on `transform`',
    hint: 'Keep the starter transition — only its timing function should change.',
    actual: ctx.animations(chip).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform',
  });
  if (transition === null) return;

  ctx.expect(ctx.animations(chip).every((candidate) => candidate instanceof CSSTransition), {
    message: 'The overshoot comes from the transition alone — no keyframe animation is layered on',
    hint: 'Delete any @keyframes: a y-control value above 1 in the cubic-bezier is the whole trick.',
    actual: 'a non-transition animation is running on the chip',
    expected: 'only CSS transitions',
  });

  ctx.expect(ctx.timingOf(transition).duration === 400, {
    message: 'The slide runs over 400ms',
    hint: 'Keep the starter duration: `transition: transform 400ms …`.',
    actual: ctx.timingOf(transition).duration,
    expected: 400,
  });

  await ctx.time.seek(240);
  const sampleA = ctx.matrix(chip).e;
  await ctx.time.seek(270);
  const sampleB = ctx.matrix(chip).e;
  await ctx.time.seek(300);
  const sampleC = ctx.matrix(chip).e;
  await ctx.time.seek(330);
  const sampleD = ctx.matrix(chip).e;
  const peak = Math.max(sampleA, sampleB, sampleC, sampleD);
  ctx.expect(peak > 162, {
    message: 'Mid-flight the chip travels past its 160px destination',
    hint: 'Push an output control value above 1 — try `cubic-bezier(0.34, 1.56, 0.64, 1)`. The default `ease` never leaves the 0–1 range.',
    actual: `peak ${peak.toFixed(1)}px across samples at 240/270/300/330ms`,
    expected: 'a peak beyond 162px',
  });

  await ctx.time.seek(400);
  ctx.expectClose(ctx.matrix(chip).e, 160, POSITION_EPSILON_PX, {
    message: 'The chip lands exactly on translateX(160px)',
    hint: 'Overshoot is the journey, not the destination: the hover state stays `translateX(160px)`.',
  });

  const timingFunction = ctx.computed(chip, 'transition-timing-function');
  const parsed = BEZIER_PATTERN.exec(timingFunction);
  const y1 = parsed === null ? Number.NaN : Number.parseFloat(parsed[2] ?? '');
  const y2 = parsed === null ? Number.NaN : Number.parseFloat(parsed[4] ?? '');
  ctx.expect(y1 > 1 || y2 > 1, {
    message: 'The timing function is a custom cubic-bezier with an output value above 1',
    hint: 'Keyword easings (`ease`, `ease-out`, …) cannot overshoot; write `cubic-bezier(x1, y1, x2, y2)` with y1 or y2 > 1.',
    actual: timingFunction,
    expected: 'cubic-bezier(…) with y1 > 1 or y2 > 1',
  });
}
```

`transforms-3d/card-flip` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — hover flips 180° over ~600ms | a transform `CSSTransition` on `.card` after hovering `.scene`, duration in [350, 850]; at mid-seek: `|m11| < 0.95` (turning); at `seek(duration)`: `m11 ≈ −1` (rotateY(180°): m11 = cos 180° = −1) |
| 2 — real 3D | computed `transform-style` on `.card` is `preserve-3d`; computed `perspective` on `.scene` parses > 0 |
| 3 — backface hidden, back pre-rotated | `backface-visibility: hidden` on both faces; resting `.back` matrix has `m11 ≈ −1` and `m33 ≈ −1` |

Create `src/challenges/transforms-3d/card-flip.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const ROTATION_EPSILON = 0.05;

function transitionPropertyOf(animation: Animation): string | null {
  return animation instanceof CSSTransition ? animation.transitionProperty : null;
}

/**
 * Grades `transforms-3d/card-flip`. Rotation is read through DOMMatrix components: for
 * rotateY(θ), m11 = cos θ — so resting is 1, mid-flip is near 0, and a full flip is −1. The back
 * face's permanent pre-rotation reads the same way at rest.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const scene = ctx.query('.scene');
  const card = ctx.query('.card');
  if (scene === null || card === null) {
    throw new Error('the grader needs the `.scene` and `.card` elements from the starter markup — keep the class names');
  }

  ctx.expect(ctx.computed(card, 'transform-style') === 'preserve-3d', {
    message: 'The card preserves 3D for its faces',
    hint: 'Without `transform-style: preserve-3d` on `.card`, the faces are flattened into a painted plane.',
    actual: ctx.computed(card, 'transform-style'),
    expected: 'preserve-3d',
  });

  const perspective = ctx.computed(scene, 'perspective');
  ctx.expect(perspective !== 'none' && pxNumber(perspective) > 0, {
    message: 'The scene supplies perspective',
    hint: 'Put `perspective: 800px` on `.scene` — on the parent, so the whole card shares one vanishing point.',
    actual: perspective,
    expected: 'a positive length, e.g. 800px',
  });

  const front = ctx.query('.front');
  const back = ctx.query('.back');
  ctx.expect(front !== null && ctx.computed(front, 'backface-visibility') === 'hidden', {
    message: 'The front face hides its reverse side',
    hint: 'Give `.face` (both faces) `backface-visibility: hidden`.',
    actual: front === null ? 'no .front element' : ctx.computed(front, 'backface-visibility'),
    expected: 'hidden',
  });
  ctx.expect(back !== null && ctx.computed(back, 'backface-visibility') === 'hidden', {
    message: 'The back face hides its reverse side',
    hint: '`backface-visibility: hidden` belongs on both faces, not just the front.',
    actual: back === null ? 'no .back element' : ctx.computed(back, 'backface-visibility'),
    expected: 'hidden',
  });
  if (back !== null) {
    const backMatrix = ctx.matrix(back);
    ctx.expect(Math.abs(backMatrix.m11 + 1) < ROTATION_EPSILON && Math.abs(backMatrix.m33 + 1) < ROTATION_EPSILON, {
      message: 'The back face is pre-rotated 180° so it reads correctly when shown',
      hint: 'Give `.back` a permanent `transform: rotateY(180deg)` — it never animates; the card does.',
      actual: `m11 ${backMatrix.m11.toFixed(2)}, m33 ${backMatrix.m33.toFixed(2)}`,
      expected: 'm11 ≈ −1 and m33 ≈ −1 (rotateY(180deg))',
    });
  }

  ctx.expectClose(ctx.matrix(card).m11, 1, ROTATION_EPSILON, {
    message: 'At rest the card faces forward',
    hint: 'The resting `.card` rule should not rotate — the flip lives in the hover rule.',
  });

  await ctx.hover(scene);

  const transition =
    ctx.animations(card).find((candidate) => transitionPropertyOf(candidate) === 'transform') ?? null;
  ctx.expect(transition !== null, {
    message: 'Hovering the scene starts a transition on the card',
    hint: 'Two rules: `transition: transform 600ms ease;` on `.card`, and `.scene:hover .card { transform: rotateY(180deg); }`.',
    actual: ctx.animations(card).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform',
  });
  if (transition === null) return;

  const duration = ctx.timingOf(transition).duration;
  const durationMs = typeof duration === 'number' ? duration : Number.NaN;
  ctx.expect(durationMs >= 350 && durationMs <= 850, {
    message: 'The flip takes roughly 600ms',
    hint: 'Give the transition a duration near 600ms — fast enough to feel responsive, slow enough to read as 3D.',
    actual: durationMs,
    expected: 'between 350ms and 850ms',
  });
  if (Number.isNaN(durationMs)) return;

  await ctx.time.seek(durationMs / 2);
  const midM11 = ctx.matrix(card).m11;
  ctx.expect(Math.abs(midM11) < 0.95, {
    message: 'Half-way through, the card is visibly turning',
    hint: 'If the card is already fully flipped mid-transition, the transition is missing from the resting `.card` rule.',
    actual: `m11 ${midM11.toFixed(2)} at ${Math.round(durationMs / 2)}ms`,
    expected: 'a value strictly between −0.95 and 0.95 (cos of a mid-flip angle)',
  });

  await ctx.time.seek(durationMs);
  ctx.expectClose(ctx.matrix(card).m11, -1, ROTATION_EPSILON, {
    message: 'The hover state is a full 180° flip',
    hint: 'The hover rule is `transform: rotateY(180deg)` — 90° would leave the card edge-on and invisible.',
  });
}
```

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. `snappy-ease` contributes rule-3 tests and a passing must-NOT-have-a-grader test only — no rule 5/6 entries (it filters out of `autoGraded`). Rule 6: the `overshoot-bezier` starter (already sliding, with `ease`) fails the overshoot-peak and bezier-parse assertions — a starter that half-works still genuinely fails; the `card-flip` starter fails preserve-3d, perspective, backface, pre-rotation, and the missing transition.

- [ ] **Step 5: Mutation checks**

1. In `overshoot-bezier.ts`, temporarily copy the STARTER's `transition: transform 400ms ease;` into the SOLUTION. Run `pnpm test:catalog`. Expected: rule 5 FAILS on the overshoot-peak and bezier-parse assertions — the solution/goals contradiction class. Restore.
2. In `snappy-ease.ts`, temporarily create an empty `src/challenges/easing-timing/snappy-ease.grade.ts` exporting a trivial `grade`. Expected: `pnpm test:catalog` FAILS the "must NOT have a grader" test for the rubric challenge — the rubric branch of the gate is alive. Delete the file.
3. In `card-flip.ts`, temporarily change the SOLUTION's hover rule to `rotateY(90deg)`. Expected: rule 5 FAILS on the final m11 ≈ −1 assertion (cos 90° = 0). Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read all three `goals` arrays against solutions (and, for the two auto challenges, against graders). `snappy-ease` has no grader: confirm instead that each of its goals is literally true of the reference solution and covered by a rubric item, and that its starter differs from the solution (the static distinct-files rule needs real difference — here the timing function).

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/easing-timing src/challenges/transforms-3d
git commit -m "feat(challenges): easing curves and 3d card flip challenges"
```

---
## Task 8: SVG line drawing and a scroll-driven progress bar

**Files:**
- Create: `src/challenges/svg-animation/line-draw.ts`, `src/challenges/svg-animation/line-draw.grade.ts`, `src/challenges/scroll-driven/scroll-progress.ts`, `src/challenges/scroll-driven/scroll-progress.grade.ts`

**Interfaces:**
- Consumes: `Challenge`, `GradeContext` (`query`, `animations`, `timingOf`, `computed`, `matrix`, `root`, `scrollTo`, `expect`, `expectClose`, `time.seek`, `time.settle`), `pxNumber` from `@/sandbox/grader-utils`. Sandbox facts: SVG is authored inline inside the `index.html` fragment (separate `.svg` files are not a supported sandbox file type); `ctx.scrollTo(y)` sets the frame document's `scrollingElement.scrollTop` and waits two native frames, which is when Chromium has restyled scroll-driven animations; the grading viewport is 800×600 (`DEFAULT_ENVIRONMENT`).
- Produces: the SVG-property grader pattern (numeric `stroke-*` reads via `pxNumber`) and the scroll-driven pattern (assert at top / half / bottom of the real scroll range — **never** `seek`/`settle` a scroll-driven animation: its currentTime is a percentage, not milliseconds). Both are Plan 06 templates.

- [ ] **Step 1: Write the two challenge modules**

Create `src/challenges/svg-animation/line-draw.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'svg-animation/line-draw',
  title: 'Draw the line',
  categoryId: 'svg-animation',
  difficulty: 'novice',
  tech: ['css', 'svg'],
  runtime: 'dom',
  estimatedMinutes: 10,
  tags: ['svg', 'stroke-dasharray', 'stroke-dashoffset', 'line-drawing'],
  brief: [
    'The classic SVG reveal: a stroke that draws itself tip to tail.',
    '',
    'The path is set up with `pathLength="400"`, so its length is exactly 400 units regardless of',
    'geometry. In styles.css: make the line start invisible with a dash pattern that covers the whole',
    'path and an offset that pushes it out of view, then animate `stroke-dashoffset` to 0 over 900ms',
    'with `ease-in-out`, holding the drawn state at the end.',
  ].join('\n'),
  goals: [
    'The path starts invisible: `stroke-dasharray` covers the whole 400-unit line and `stroke-dashoffset` starts at 400.',
    'A CSS animation pulls `stroke-dashoffset` to 0 over 900ms with `ease-in-out` — half drawn at the halfway point.',
    'The line stays fully drawn when the animation ends (a forwards fill).',
  ],
  starter: {
    'index.html': [
      '<svg viewBox="0 0 200 100" width="200" height="100" role="img" aria-label="A curved line">',
      '  <path',
      '    class="line"',
      '    pathLength="400"',
      '    d="M 10 80 C 60 10, 140 10, 190 80"',
      '    fill="none"',
      '    stroke="#0ea5e9"',
      '    stroke-width="4"',
      '    stroke-linecap="round"',
      '  />',
      '</svg>',
      '',
    ].join('\n'),
    'styles.css': ['/* Hide the line behind its dash pattern, then animate stroke-dashoffset to 0. */', ''].join('\n'),
  },
  solution: {
    'index.html': [
      '<svg viewBox="0 0 200 100" width="200" height="100" role="img" aria-label="A curved line">',
      '  <path',
      '    class="line"',
      '    pathLength="400"',
      '    d="M 10 80 C 60 10, 140 10, 190 80"',
      '    fill="none"',
      '    stroke="#0ea5e9"',
      '    stroke-width="4"',
      '    stroke-linecap="round"',
      '  />',
      '</svg>',
      '',
    ].join('\n'),
    'styles.css': [
      '.line {',
      '  stroke-dasharray: 400;',
      '  stroke-dashoffset: 400;',
      '  animation: draw 900ms ease-in-out forwards;',
      '}',
      '',
      '@keyframes draw {',
      '  to {',
      '    stroke-dashoffset: 0;',
      '  }',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'A dashed stroke is a repeating pattern of dash and gap. `stroke-dasharray: 400` makes both the',
    'dash and the gap as long as the entire path, and `stroke-dashoffset: 400` slides the pattern one',
    'full length backward — so the visible window shows only gap. Animating the offset to 0 slides',
    'the single dash into view from the start of the path: the line "draws".',
    '',
    '### Why `pathLength="400"` matters',
    '',
    'Without it, the dash math needs `getTotalLength()` — a JS call — because the true length of a',
    'curve is awkward to know by hand. `pathLength` renormalises the path to a length you chose, so',
    'the CSS speaks in round numbers and the technique stays JS-free. Change the `d` attribute and',
    'nothing else needs to move.',
    '',
    '### The `to`-only keyframe',
    '',
    'The `@keyframes draw` rule declares only `to`: the `from` state comes from the resting styles.',
    'That is deliberate — one source of truth for the hidden state. And as with every entrance in',
    'this catalog, the fill mode (`forwards`) is what stops the line un-drawing itself when the',
    'animation ends.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Both dash values are the path length: `stroke-dasharray: 400; stroke-dashoffset: 400;` hides everything.',
    'One keyframe is enough: `@keyframes draw { to { stroke-dashoffset: 0; } }` — the from state is the resting style.',
    'The shorthand: `animation: draw 900ms ease-in-out forwards;` — without `forwards` the line vanishes again.',
  ],
  relatedIds: [],
};
```

Create `src/challenges/scroll-driven/scroll-progress.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'scroll-driven/scroll-progress',
  title: 'A scroll-driven progress bar',
  categoryId: 'scroll-driven',
  difficulty: 'intermediate',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 12,
  tags: ['scroll-timeline', 'scroll-driven', 'progress', 'compositor'],
  brief: [
    'A reading-progress bar with zero JavaScript.',
    '',
    'The page below is tall. Pin the `.progress` bar to the top and drive it with a scroll timeline:',
    'a keyframes animation from `scaleX(0)` to `scaleX(1)` whose timeline is `scroll(root)`, so the',
    'bar tracks how far down the page the reader is. Grow it with `transform: scaleX()` from the left',
    'edge — never by animating `width`.',
  ].join('\n'),
  goals: [
    'The bar is driven by a `scroll()` animation timeline — no JavaScript, no scroll listeners.',
    'At the top of the page the bar is at `scaleX(0)`; half-way down it reads about 0.5; at the bottom it spans the full width.',
    'The bar grows with `transform: scaleX()` from the left edge — its `width` never animates.',
  ],
  starter: {
    'index.html': [
      '<div class="progress" aria-hidden="true"></div>',
      '<article class="content">',
      '  <h1>Long read</h1>',
      '  <p>Scroll to see the bar track your progress.</p>',
      '</article>',
      '',
    ].join('\n'),
    'styles.css': [
      '.progress {',
      '  position: fixed;',
      '  top: 0;',
      '  left: 0;',
      '  width: 100%;',
      '  height: 6px;',
      '  background: #38bdf8;',
      '  transform-origin: 0 50%;',
      '  transform: scaleX(0);',
      '}',
      '',
      '/* Animate .progress from scaleX(0) to scaleX(1), driven by scroll(root). */',
      '',
      '.content {',
      '  min-height: 3000px;',
      '  padding: 24px;',
      '  font: 16px/1.6 system-ui, sans-serif;',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': [
      '<div class="progress" aria-hidden="true"></div>',
      '<article class="content">',
      '  <h1>Long read</h1>',
      '  <p>Scroll to see the bar track your progress.</p>',
      '</article>',
      '',
    ].join('\n'),
    'styles.css': [
      '.progress {',
      '  position: fixed;',
      '  top: 0;',
      '  left: 0;',
      '  width: 100%;',
      '  height: 6px;',
      '  background: #38bdf8;',
      '  transform-origin: 0 50%;',
      '  transform: scaleX(0);',
      '  animation: grow-progress auto linear both;',
      '  animation-timeline: scroll(root);',
      '}',
      '',
      '@keyframes grow-progress {',
      '  from {',
      '    transform: scaleX(0);',
      '  }',
      '',
      '  to {',
      '    transform: scaleX(1);',
      '  }',
      '}',
      '',
      '.content {',
      '  min-height: 3000px;',
      '  padding: 24px;',
      '  font: 16px/1.6 system-ui, sans-serif;',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'An `animation-timeline` swaps the clock an animation runs on. `scroll(root)` is a timeline whose',
    '"time" is the root scroller’s progress: 0 at the top, 1 at the bottom. The keyframes are an',
    'ordinary `scaleX(0)` → `scaleX(1)` pair; scrolling scrubs them. `linear` matters — you want the',
    'bar proportional to scroll, not eased — and the `auto` duration lets the timeline’s range',
    'define the animation’s length.',
    '',
    '### Declaration order matters',
    '',
    'The `animation` shorthand resets `animation-timeline` to its default. Write the shorthand first',
    'and `animation-timeline: scroll(root)` after it — reversed, the timeline silently becomes the',
    'document clock and the bar fills in 0 seconds.',
    '',
    '### Why `scaleX`, not `width`',
    '',
    'Scroll-driven animations restyle on every scrolled frame. Animating `width` would relayout the',
    'page per frame; `transform: scaleX()` with `transform-origin: 0 50%` stretches a painted layer',
    'on the compositor — same visual, none of the cost. This is the compositor-property rule from the',
    'CSS challenges, applied where it hurts most.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Keyframes first: `@keyframes grow-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }`.',
    'Attach them with `animation: grow-progress auto linear both;` and THEN `animation-timeline: scroll(root);` — the shorthand resets the timeline if it comes second.',
    'If the bar is full before you scroll, the timeline line is missing (or above the shorthand) and the animation ran on the normal clock.',
  ],
  relatedIds: [],
};
```

- [ ] **Step 2: Watch the catalog gate demand the graders**

Run: `pnpm test:catalog`
Expected: FAIL — both new challenges fail the grader-file rule (and rule 5, via the `no grader is registered` throw); rule 3 green.

- [ ] **Step 3: Write the two graders**

`svg-animation/line-draw` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — starts invisible | computed `stroke-dasharray` ≈ 400; at `seek(0)`: `stroke-dashoffset` ≈ 400 |
| 2 — animates to 0 over 900ms, ease-in-out, half at half | a `CSSAnimation` on `.line`, duration 900; computed `animation-timing-function` is `ease-in-out`; at `seek(450)`: offset ≈ 200 (ease-in-out is symmetric, so half time is half progress) |
| 3 — stays drawn | `timingOf` fill `forwards`/`both`; after `settle()`: offset ≈ 0 |

Create `src/challenges/svg-animation/line-draw.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const OFFSET_EPSILON = 8;

/**
 * Grades `svg-animation/line-draw`. Stroke values are numeric CSS properties (`pathLength="400"`
 * normalises the geometry), so the grader reads them with pxNumber at seeked times. The 450ms
 * read is exact because ease-in-out is symmetric: half time is half progress.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const line = ctx.query('.line');
  if (line === null) {
    throw new Error('the grader needs the `.line` path from the starter markup — keep the class name');
  }

  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dasharray')), 400, 1, {
    message: 'The dash pattern covers the whole 400-unit path',
    hint: '`stroke-dasharray: 400` — one dash (and one gap) as long as the entire line.',
  });

  const animation = ctx.animations(line).find((candidate) => candidate instanceof CSSAnimation) ?? null;
  ctx.expect(animation !== null, {
    message: 'A CSS animation is drawing the line',
    hint: 'Attach one with `animation: draw 900ms ease-in-out forwards;` on `.line`.',
    actual: ctx.animations(line).length === 0 ? 'no animations on .line' : 'only non-CSS animations',
    expected: 'a CSS animation on the path',
  });
  if (animation === null) return;

  ctx.expect(ctx.timingOf(animation).duration === 900, {
    message: 'The draw takes 900ms',
    hint: 'Set the duration in the shorthand: `animation: draw 900ms …`.',
    actual: ctx.timingOf(animation).duration,
    expected: 900,
  });
  ctx.expect(ctx.computed(line, 'animation-timing-function') === 'ease-in-out', {
    message: 'The draw eases in and out',
    hint: 'Use `ease-in-out` so the pen accelerates gently and lands gently.',
    actual: ctx.computed(line, 'animation-timing-function'),
    expected: 'ease-in-out',
  });
  const fill = ctx.timingOf(animation).fill ?? 'none';
  ctx.expect(fill === 'forwards' || fill === 'both', {
    message: 'The fill mode keeps the line drawn at the end',
    hint: 'Without `forwards`, the offset snaps back to 400 and the line vanishes again.',
    actual: fill,
    expected: "'forwards' or 'both'",
  });

  await ctx.time.seek(0);
  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dashoffset')), 400, OFFSET_EPSILON, {
    message: 'At 0ms the line is fully hidden — the offset pushes the dash out of view',
    hint: 'The resting style is `stroke-dashoffset: 400` (the animation only declares the `to` state).',
  });

  await ctx.time.seek(450);
  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dashoffset')), 200, OFFSET_EPSILON, {
    message: 'At 450ms — half time — the line is half drawn',
    hint: 'Animate the OFFSET to 0, not the dasharray: `@keyframes draw { to { stroke-dashoffset: 0; } }`.',
  });

  await ctx.time.settle();
  ctx.expectClose(pxNumber(ctx.computed(line, 'stroke-dashoffset')), 0, 1, {
    message: 'After the animation the line is fully drawn and stays that way',
    hint: 'The `to` keyframe ends at `stroke-dashoffset: 0`, held by the forwards fill.',
  });
}
```

`scroll-driven/scroll-progress` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — `scroll()` timeline, no JS | computed `animation-timeline` starts with `scroll(`; (structurally, the file set contains no script file at all) |
| 2 — 0 at top, ~0.5 half-way, 1 at bottom | `matrix().a` at `scrollTo(0)` ≈ 0, at `scrollTo(max/2)` ≈ 0.5, at `scrollTo(max)` ≈ 1; plus a scroll-range sanity expect |
| 3 — scaleX from the left, width never animates | computed `transform-origin` starts at `0px`; computed `width` identical at top and bottom |

Create `src/challenges/scroll-driven/scroll-progress.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

/**
 * Grades `scroll-driven/scroll-progress`. Scroll-driven animations are scrubbed by scrolling, not
 * by the virtual clock: `ctx.scrollTo` waits the frames Chromium needs to restyle, and the grader
 * asserts computed state at three real scroll positions. It never calls `seek`/`settle` here — a
 * scroll timeline's currentTime is a percentage, and millisecond scrubbing does not apply.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const bar = ctx.query('.progress');
  if (bar === null) {
    throw new Error('the grader needs the `.progress` element from the starter markup — keep the class name');
  }

  const scroller = ctx.root.ownerDocument.scrollingElement;
  if (scroller === null) {
    throw new Error('the sandbox document has no scrolling element — this indicates a harness regression, not a content bug');
  }
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  ctx.expect(maxScroll >= 1000, {
    message: 'The page has real room to scroll',
    hint: 'Keep the tall `.content` block — without overflow there is no progress to track.',
    actual: `${maxScroll}px of scrollable range`,
    expected: 'at least 1000px',
  });

  const timeline = ctx.computed(bar, 'animation-timeline');
  ctx.expect(timeline.startsWith('scroll('), {
    message: 'The bar is driven by a scroll() animation timeline',
    hint: 'After the `animation` shorthand, add `animation-timeline: scroll(root);` — order matters, the shorthand resets it.',
    actual: timeline,
    expected: "a value starting with 'scroll('",
  });

  const origin = ctx.computed(bar, 'transform-origin');
  ctx.expect(origin.startsWith('0px'), {
    message: 'The bar grows from the left edge',
    hint: 'Keep `transform-origin: 0 50%` — a centered origin makes the bar grow from the middle outward.',
    actual: origin,
    expected: 'an origin on the left edge (0px …)',
  });

  await ctx.scrollTo(0);
  const widthAtTop = pxNumber(ctx.computed(bar, 'width'));
  ctx.expectClose(ctx.matrix(bar).a, 0, 0.02, {
    message: 'At the top of the page the bar is at scaleX(0)',
    hint: 'The `from` keyframe (and the resting style) is `transform: scaleX(0)`.',
  });

  await ctx.scrollTo(maxScroll / 2);
  ctx.expectClose(ctx.matrix(bar).a, 0.5, 0.05, {
    message: 'Half-way down the page the bar is about half drawn',
    hint: 'Use `linear` timing — an eased curve makes the bar lie about reading progress.',
  });

  await ctx.scrollTo(maxScroll);
  ctx.expectClose(ctx.matrix(bar).a, 1, 0.02, {
    message: 'At the bottom the bar spans the full width',
    hint: 'The `to` keyframe is `transform: scaleX(1)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(bar, 'width')), widthAtTop, 0.5, {
    message: 'The width never animates — only the scale changes',
    hint: 'Grow with `transform: scaleX()`; animating `width` relayouts the page on every scrolled frame.',
  });
}
```

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. Rule 6: the `line-draw` starter fails the dasharray, animation, and offset assertions (the line renders fully visible); the `scroll-progress` starter fails the timeline assertion (computed `animation-timeline` is its default) and the half/bottom scale reads (the bar never grows).

If rule 5 fails on `scroll-progress` with the half-way read at 0 while top passes, the two-native-frame wait inside `ctx.scrollTo` was not enough for scroll-driven restyling in headless Chromium — a runner finding worth reporting; do not paper over it by widening the epsilon past 0.05.

- [ ] **Step 5: Mutation checks**

1. In `line-draw.ts`, temporarily change the SOLUTION's animation to `animation: draw 900ms ease-in-out;` (no fill). Run `pnpm test:catalog`. Expected: rule 5 FAILS on the fill assertion and the post-`settle` offset read (snaps back to 400). Restore.
2. In `scroll-progress.ts`, temporarily swap the SOLUTION's two animation lines so `animation-timeline` comes before the shorthand. Expected: rule 5 FAILS on the timeline assertion (the shorthand reset it) — this is precisely the declaration-order lesson the explanation teaches, now machine-caught. Restore.
3. In `scroll-progress.ts`, temporarily change the SOLUTION's keyframes to animate `width` from 0 to 100% instead of scaleX. Expected: rule 5 FAILS on the scale reads and the width-stability assertion. Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read both `goals` arrays against graders and solutions. The scroll challenge's goal 2 promises "about 0.5" — confirm the assertion's epsilon (0.05) matches "about", and that the linear timing in the solution is what makes it true.

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/svg-animation src/challenges/scroll-driven
git commit -m "feat(challenges): svg line draw and scroll-driven progress challenges"
```

---
## Task 9: Reduced motion and interruption

**Files:**
- Create: `src/challenges/accessibility/reduced-motion-swap.ts`, `src/challenges/accessibility/reduced-motion-swap.grade.ts`, `src/challenges/interruption-state/reversible-hover.ts`, `src/challenges/interruption-state/reversible-hover.grade.ts`

**Interfaces:**
- Consumes: `Challenge`, `GradeContext` (`query`, `animations`, `timingOf`, `computed`, `matrix`, `hover`, `unhover`, `setReducedMotion`, `expect`, `expectClose`, `time.seek`, `time.settle`), `pxNumber` from `@/sandbox/grader-utils`. Environment facts (Plan 02 Task 9): `ctx.setReducedMotion(value)` **remounts** — every previously held element reference goes stale and must be re-queried; it patches `matchMedia` for JS reads AND flips `@media (prefers-reduced-motion: …)` blocks for CSS, so both branches are assertable in one grade run. **Single-clause PRM queries only** — the patch answers compound queries solely from the reduced-motion clause.
- Produces: the both-branches accessibility grader pattern and the interruption pattern (`seek(0)` on a freshly retargeted transition reads its start value — the mechanical proof that a reversal "does not snap"). Both are Plan 06 templates.

- [ ] **Step 1: Write the two challenge modules**

Create `src/challenges/accessibility/reduced-motion-swap.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'accessibility/reduced-motion-swap',
  title: 'Replace the motion, keep the message',
  categoryId: 'accessibility',
  difficulty: 'novice',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 10,
  tags: ['prefers-reduced-motion', 'accessibility', 'media-query', 'entrance'],
  brief: [
    'The banner slides in from the right — a 320px sweep. For someone with a vestibular disorder,',
    'large translations like that can be physically unpleasant, and they have told the browser so.',
    '',
    'Honour `prefers-reduced-motion: reduce` — but do not simply delete the animation. The banner is',
    'feedback; it still needs an entrance. Swap the slide for a plain fade of the same duration, so',
    'reduced-motion users get the message without the motion.',
  ].join('\n'),
  goals: [
    'By default the banner slides in from 320px to the right of its resting spot, fading in as it arrives, over 500ms.',
    'When `prefers-reduced-motion: reduce` is set, the banner still animates in — a fade of the same 500ms duration.',
    'Under reduced motion the banner never moves horizontally: the motion is replaced, not the feedback deleted.',
  ],
  starter: {
    'index.html': '<div class="banner" role="status">Saved</div>\n',
    'styles.css': [
      '.banner {',
      '  width: 220px;',
      '  padding: 12px 16px;',
      '  border-radius: 10px;',
      '  background: #22c55e;',
      '  color: white;',
      '  font: 600 14px/1.2 system-ui, sans-serif;',
      '  animation: slide-in 500ms ease-out both;',
      '}',
      '',
      '@keyframes slide-in {',
      '  from {',
      '    transform: translateX(320px);',
      '    opacity: 0;',
      '  }',
      '',
      '  to {',
      '    transform: translateX(0);',
      '    opacity: 1;',
      '  }',
      '}',
      '',
      '/* Respect prefers-reduced-motion: reduce — swap the slide for a fade. */',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': '<div class="banner" role="status">Saved</div>\n',
    'styles.css': [
      '.banner {',
      '  width: 220px;',
      '  padding: 12px 16px;',
      '  border-radius: 10px;',
      '  background: #22c55e;',
      '  color: white;',
      '  font: 600 14px/1.2 system-ui, sans-serif;',
      '  animation: slide-in 500ms ease-out both;',
      '}',
      '',
      '@keyframes slide-in {',
      '  from {',
      '    transform: translateX(320px);',
      '    opacity: 0;',
      '  }',
      '',
      '  to {',
      '    transform: translateX(0);',
      '    opacity: 1;',
      '  }',
      '}',
      '',
      '@keyframes fade-in {',
      '  from {',
      '    opacity: 0;',
      '  }',
      '',
      '  to {',
      '    opacity: 1;',
      '  }',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  .banner {',
      '    animation-name: fade-in;',
      '  }',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'The media query overrides one longhand — `animation-name` — so the reduced branch inherits the',
    'duration, easing, and fill from the default rule and swaps only the keyframes. The fade has no',
    'transform at all: under reduced motion the banner appears in place.',
    '',
    '### Replace, do not delete',
    '',
    'The lazy fix is `animation: none`, and it is a real accessibility bug of its own: the user asked',
    'for less *motion*, not less *information*. A banner that pops in with no transition at all is',
    'harder to notice — the entrance exists to draw the eye. A fade draws the eye without moving',
    'anything. Reduced motion is a substitution problem, not a deletion problem.',
    '',
    '### What counts as "motion"',
    '',
    'Large translations, parallax, zooms, and spins are the vestibular triggers; opacity and color',
    'are safe. That is why the swap keeps `opacity` and drops `transform`. The same substitution',
    'thinking scales up: the vestibular-safe parallax replacement later in this category is this',
    'challenge at page scale.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Add a second `@keyframes` (a plain fade), then override ONLY `animation-name` inside the media query.',
    'The query is `@media (prefers-reduced-motion: reduce) { … }` — keep it a single clause.',
    'Overriding just `animation-name` keeps the 500ms duration and fill from the default rule — that is the point.',
  ],
  relatedIds: ['css-keyframes/bounce-in'],
};
```

Create `src/challenges/interruption-state/reversible-hover.ts`:

```ts
import type { Challenge } from '@/challenges/types';

export const challenge: Challenge = {
  id: 'interruption-state/reversible-hover',
  title: 'Reversible hover',
  categoryId: 'interruption-state',
  difficulty: 'intermediate',
  tech: ['css'],
  runtime: 'dom',
  estimatedMinutes: 10,
  tags: ['transition', 'interruption', 'reversal', 'hover'],
  brief: [
    'Hover the track: the knob glides right. Leave — and it teleports home. Users flick pointers',
    'across interfaces constantly; every flick across this track snaps.',
    '',
    'The starter declares its `transition` inside the `:hover` rule, so the transition only exists',
    'while hovered. Fix the placement so both directions animate — and so that leaving mid-flight',
    'reverses smoothly from wherever the knob currently is.',
  ].join('\n'),
  goals: [
    'Hovering the track slides the knob 120px right over 600ms (linear), and leaving hover animates it back — both directions transition.',
    'Interrupted mid-flight, the knob reverses from exactly where it is: the return transition starts at the interruption point, never snapping to either end.',
    'The knob moves with `transform` only — never `left` or `margin`.',
  ],
  starter: {
    'index.html': [
      '<div class="track">',
      '  <div class="knob" aria-hidden="true"></div>',
      '</div>',
      '',
    ].join('\n'),
    'styles.css': [
      '.track {',
      '  display: flex;',
      '  align-items: center;',
      '  width: 180px;',
      '  height: 44px;',
      '  padding: 4px;',
      '  border-radius: 9999px;',
      '  background: #e2e8f0;',
      '}',
      '',
      '.knob {',
      '  width: 36px;',
      '  height: 36px;',
      '  border-radius: 50%;',
      '  background: #0f172a;',
      '}',
      '',
      '.track:hover .knob {',
      '  transform: translateX(120px);',
      '  transition: transform 600ms linear;',
      '}',
      '',
    ].join('\n'),
  },
  solution: {
    'index.html': [
      '<div class="track">',
      '  <div class="knob" aria-hidden="true"></div>',
      '</div>',
      '',
    ].join('\n'),
    'styles.css': [
      '.track {',
      '  display: flex;',
      '  align-items: center;',
      '  width: 180px;',
      '  height: 44px;',
      '  padding: 4px;',
      '  border-radius: 9999px;',
      '  background: #e2e8f0;',
      '}',
      '',
      '.knob {',
      '  width: 36px;',
      '  height: 36px;',
      '  border-radius: 50%;',
      '  background: #0f172a;',
      '  transition: transform 600ms linear;',
      '}',
      '',
      '.track:hover .knob {',
      '  transform: translateX(120px);',
      '}',
      '',
    ].join('\n'),
  },
  explanation: [
    '### Why this works',
    '',
    'A transition applies when the *destination* state has one. Declared only inside `:hover`, it',
    'exists on the way in (destination: hovered) and vanishes on the way out (destination: resting,',
    'which has no `transition`) — so the return snaps. Moving the declaration to the resting `.knob`',
    'rule puts it on both destinations: in animates, out animates.',
    '',
    '### Interruption is free — if the transition lives in the right place',
    '',
    'CSS transitions retarget: when the hover ends mid-flight, the browser starts the new transition',
    'from the *current computed value*, not from the hover endpoint. There is no state to manage and',
    'no JS to write — the smooth mid-flight reversal falls out of correct declaration placement.',
    '(The browser even shortens the return duration proportionally, so a 10%-progressed slide does',
    'not take the full 600ms to undo.)',
    '',
    '### The pattern to remember',
    '',
    'Transitions on the base rule, state changes in the state rules. Every interruptible interaction',
    'in this category — and the expert-level velocity handoffs later — builds on this placement rule.',
  ].join('\n'),
  gradeMode: 'auto',
  hints: [
    'Watch what changes between the starter rules: WHERE the `transition` line lives is the whole bug.',
    'Transitions belong on the resting `.knob` rule; the `:hover` rule should only change `transform`.',
    'To test by hand: flick the pointer off the track mid-slide — the knob should turn around in place.',
  ],
  relatedIds: ['css-transitions/hover-lift'],
};
```

- [ ] **Step 2: Watch the catalog gate demand the graders**

Run: `pnpm test:catalog`
Expected: FAIL — both new challenges fail the grader-file rule (and rule 5, via the `no grader is registered` throw); rule 3 green.

- [ ] **Step 3: Write the two graders**

`accessibility/reduced-motion-swap` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — default branch slides in from 320px, fading, 500ms | with `setReducedMotion(false)`: an animation exists with duration 500; at `seek(0)`: e ≈ 320, opacity ≈ 0; after `settle()`: e ≈ 0, opacity ≈ 1 |
| 2 — reduced branch still animates, same 500ms | with `setReducedMotion(true)`: an animation exists with duration 500; at `seek(0)`: opacity ≈ 0; after `settle()`: opacity ≈ 1 |
| 3 — reduced branch never moves | in the reduced branch: e ≈ 0 at `seek(0)` AND at `seek(250)` |

Create `src/challenges/accessibility/reduced-motion-swap.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

const POSITION_EPSILON_PX = 1;
const OPACITY_EPSILON = 0.05;

function bannerAnimation(ctx: GradeContext, banner: Element): Animation | null {
  return ctx.animations(banner).find((candidate) => candidate instanceof CSSAnimation) ?? null;
}

/**
 * Grades `accessibility/reduced-motion-swap` across BOTH media branches in one run:
 * `setReducedMotion` remounts with the flag forced, so each branch is asserted explicitly (the
 * grader never trusts the machine's real OS preference). Element references are re-queried after
 * every remount — the old ones go stale.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  await ctx.setReducedMotion(false);
  const banner = ctx.query('.banner');
  if (banner === null) {
    throw new Error('the grader needs the `.banner` element from the starter markup — keep the class name');
  }

  const motionAnimation = bannerAnimation(ctx, banner);
  ctx.expect(motionAnimation !== null, {
    message: 'With no motion preference, the banner has an entrance animation',
    hint: 'Keep the starter `slide-in` animation on `.banner` — the media query only overrides it.',
    actual: 'no CSS animation on .banner',
    expected: 'a running entrance animation',
  });
  if (motionAnimation === null) return;
  ctx.expect(ctx.timingOf(motionAnimation).duration === 500, {
    message: 'The default entrance runs 500ms',
    hint: 'Keep the starter duration; the reduced branch will inherit it.',
    actual: ctx.timingOf(motionAnimation).duration,
    expected: 500,
  });

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(banner).e, 320, POSITION_EPSILON_PX * 4, {
    message: 'By default the banner starts 320px to the right',
    hint: 'The slide-in `from` frame is `transform: translateX(320px)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(banner, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'By default the banner fades in as it slides',
    hint: 'The `from` frame also carries `opacity: 0`.',
  });
  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(banner).e, 0, POSITION_EPSILON_PX, {
    message: 'The slide lands at the resting position',
    hint: 'The `to` frame ends at `translateX(0)`.',
  });

  await ctx.setReducedMotion(true);
  const calmBanner = ctx.query('.banner');
  if (calmBanner === null) {
    throw new Error('the banner disappeared after the reduced-motion remount — keep the markup unchanged');
  }

  const calmAnimation = bannerAnimation(ctx, calmBanner);
  ctx.expect(calmAnimation !== null, {
    message: 'Under reduced motion the banner STILL animates in — the feedback is not deleted',
    hint: 'Do not use `animation: none`. Swap `animation-name` to a fade inside `@media (prefers-reduced-motion: reduce)`.',
    actual: 'no CSS animation on .banner under reduced motion',
    expected: 'a calmer entrance animation',
  });
  if (calmAnimation === null) return;
  ctx.expect(ctx.timingOf(calmAnimation).duration === 500, {
    message: 'The reduced entrance keeps the same 500ms duration',
    hint: 'Override only `animation-name` in the media query — duration, easing, and fill inherit from the default rule.',
    actual: ctx.timingOf(calmAnimation).duration,
    expected: 500,
  });

  await ctx.time.seek(0);
  ctx.expectClose(pxNumber(ctx.computed(calmBanner, 'opacity')), 0, OPACITY_EPSILON, {
    message: 'The reduced entrance is a fade: it starts transparent',
    hint: 'The fade keyframes go from `opacity: 0` to `opacity: 1`.',
  });
  ctx.expectClose(ctx.matrix(calmBanner).e, 0, POSITION_EPSILON_PX, {
    message: 'Under reduced motion the banner starts in place — no horizontal offset',
    hint: 'The fade keyframes must not touch `transform`.',
  });
  await ctx.time.seek(250);
  ctx.expectClose(ctx.matrix(calmBanner).e, 0, POSITION_EPSILON_PX, {
    message: 'Under reduced motion the banner never moves mid-entrance either',
    hint: 'If it moves at 250ms, the slide keyframes are still the active `animation-name` in the reduced branch.',
  });
  await ctx.time.settle();
  ctx.expectClose(pxNumber(ctx.computed(calmBanner, 'opacity')), 1, OPACITY_EPSILON, {
    message: 'The reduced entrance ends fully visible',
    hint: 'The fade ends at `opacity: 1`, held by the inherited fill mode.',
  });
}
```

`interruption-state/reversible-hover` — goal→assertion map:

| Goal | Assertion(s) |
| --- | --- |
| 1 — both directions animate | after hovering + `settle()`: e ≈ 120; after unhovering: a fresh transform `CSSTransition` exists (the starter has none here — its transition lives in the hover rule); after `settle()`: e ≈ 0 |
| 2 — reversal starts at the interruption point | hover again, `seek(300)`: e ≈ 60; unhover; on the fresh transition, `seek(0)`: e ≈ 60 (the return's START equals the interruption point — the mechanical definition of "no snap"); after `settle()`: e ≈ 0 |
| 3 — transform only | computed `left` is `auto` and `margin-left` is `0px` |

Create `src/challenges/interruption-state/reversible-hover.grade.ts`:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

const POSITION_EPSILON_PX = 2;

function transformTransition(ctx: GradeContext, el: Element): Animation | null {
  return (
    ctx
      .animations(el)
      .find((candidate) => candidate instanceof CSSTransition && candidate.transitionProperty === 'transform') ?? null
  );
}

/**
 * Grades `interruption-state/reversible-hover`. The "no snap" proof is mechanical: after
 * interrupting mid-flight, the freshly retargeted return transition is scrubbed to ITS time 0 —
 * which reads the value the browser retargeted FROM. If that equals the interruption point, the
 * reversal is smooth by construction; the starter (transition declared inside :hover) has no
 * return transition at all and teleports.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const track = ctx.query('.track');
  const knob = ctx.query('.knob');
  if (track === null || knob === null) {
    throw new Error('the grader needs the `.track` and `.knob` elements from the starter markup — keep the class names');
  }

  // Phase 1: a full round trip.
  await ctx.hover(track);
  const outbound = transformTransition(ctx, knob);
  ctx.expect(outbound !== null, {
    message: 'Hovering starts a transition on the knob',
    hint: 'The knob needs a `transition: transform 600ms linear;` — check WHERE it is declared.',
    actual: ctx.animations(knob).length === 0 ? 'no animations after hover' : 'animations on other properties only',
    expected: 'a CSS transition on transform',
  });
  if (outbound !== null) {
    ctx.expect(ctx.timingOf(outbound).duration === 600, {
      message: 'The slide runs over 600ms',
      hint: 'Keep the 600ms linear timing from the starter.',
      actual: ctx.timingOf(outbound).duration,
      expected: 600,
    });
  }
  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(knob).e, 120, POSITION_EPSILON_PX, {
    message: 'The hovered knob rests 120px to the right',
    hint: 'The hover rule is `transform: translateX(120px)`.',
  });

  await ctx.unhover(track);
  const inbound = transformTransition(ctx, knob);
  ctx.expect(inbound !== null, {
    message: 'Leaving hover ALSO animates — the return is a transition, not a teleport',
    hint: 'Declared inside `.track:hover .knob`, the transition vanishes with the hover. Move it to the resting `.knob` rule.',
    actual: inbound === null ? 'no transition after unhover — the knob snapped home' : 'found',
    expected: 'a CSS transition on transform for the return trip',
  });
  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(knob).e, 0, POSITION_EPSILON_PX, {
    message: 'The return trip lands back at the start',
    hint: 'The resting state is `translateX(0)` — no leftover offset.',
  });

  // Phase 2: interrupt mid-flight.
  await ctx.hover(track);
  await ctx.time.seek(300);
  ctx.expectClose(ctx.matrix(knob).e, 60, POSITION_EPSILON_PX, {
    message: 'Mid-flight (300ms of 600ms, linear) the knob is at 60px',
    hint: 'Linear timing makes mid-flight predictable — keep `linear` from the starter.',
  });

  await ctx.unhover(track);
  const reversal = transformTransition(ctx, knob);
  ctx.expect(reversal !== null, {
    message: 'Interrupting mid-flight starts a return transition',
    hint: 'With the transition on the resting rule, the browser retargets automatically — no JS needed.',
    actual: reversal === null ? 'no transition after the mid-flight unhover' : 'found',
    expected: 'a retargeted CSS transition',
  });
  if (reversal === null) return;

  await ctx.time.seek(0);
  ctx.expectClose(ctx.matrix(knob).e, 60, POSITION_EPSILON_PX, {
    message: 'The return starts from exactly where the knob was interrupted — no snap to either end',
    hint: 'CSS retargets transitions from the CURRENT computed value; if this reads 0 or 120, the return was not a transition at all.',
  });

  await ctx.time.settle();
  ctx.expectClose(ctx.matrix(knob).e, 0, POSITION_EPSILON_PX, {
    message: 'After the interrupted reversal the knob settles home',
    hint: 'No cleanup required — the retargeted transition finishes at the resting state on its own.',
  });

  ctx.expect(ctx.computed(knob, 'left') === 'auto' && ctx.computed(knob, 'margin-left') === '0px', {
    message: 'The movement comes from `transform` alone',
    hint: '`left`/`margin` animations re-run layout and do not retarget as cleanly — keep the translateX.',
    actual: `left: ${ctx.computed(knob, 'left')}, margin-left: ${ctx.computed(knob, 'margin-left')}`,
    expected: 'left: auto, margin-left: 0px',
  });
}
```

- [ ] **Step 4: Run the catalog gate, watch it pass**

Run: `pnpm test:catalog`
Expected: PASS. Rule 6: the `reduced-motion-swap` starter passes the default branch but fails the reduced branch (still slides: the 0ms and 250ms position reads are ≈320 and ≈160, not 0 — exactly the accessibility bug the challenge teaches); the `reversible-hover` starter animates IN but fails both "return transition exists" assertions and the interruption-point read (it snaps to 0).

- [ ] **Step 5: Mutation checks**

1. In `reduced-motion-swap.ts`, temporarily change the SOLUTION's media block to `animation: none;` instead of the name swap. Run `pnpm test:catalog`. Expected: rule 5 FAILS on the "STILL animates" assertion — the replace-not-delete goal is enforced against the lazy fix. Restore.
2. In `reduced-motion-swap.ts`, temporarily make the SOLUTION's media query compound: `@media (min-width: 1px) and (prefers-reduced-motion: reduce)`. Expected: the CSS flip still answers it (the patch keys on the reduced-motion clause) — rule 5 may PASS. This mutation documents WHY the single-clause constraint is a convention, not a mechanically-enforced rule: compound queries are answered solely from the PRM clause, which lies when the other clause matters. Restore, and keep the solution single-clause.
3. In `reversible-hover.ts`, temporarily move the SOLUTION's `transition` line back into the `:hover` rule (recreating the starter bug). Expected: rule 5 FAILS on both return-transition assertions and the interruption-point read. Restore.

- [ ] **Step 6: Audit the goal→assertion maps**

Re-read both `goals` arrays against graders and solutions. Goal 2 of `reduced-motion-swap` promises "the same 500ms duration" — confirm the solution's media query overrides only `animation-name` (that inheritance is what makes the goal literally true).

- [ ] **Step 7: Verify and commit**

```bash
pnpm format && pnpm verify
git add src/challenges/accessibility src/challenges/interruption-state
git commit -m "feat(challenges): reduced-motion and interruption challenges"
```

---
## Task 10: Vertical-slice coverage regression

**Files:**
- Create: `src/challenges/vertical-slice.test.ts`

**Interfaces:**
- Consumes: `challengeRegistry` from `@/challenges/registry`.
- Produces: a unit test pinning the slice's shape — the 17 ids, the three runtimes, the three grade modes, and the completed `bounce-in` series — so a refactor that silently drops a module from the registry glob (a rename, a glob change) fails in the inner loop, not at catalog time.

- [ ] **Step 1: Write the test (it passes immediately — Step 2 proves it can fail)**

Create `src/challenges/vertical-slice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { challengeRegistry } from '@/challenges/registry';

/** Every challenge shipped by Plans 01–03. Plan 06 appends; it never removes. */
const SLICE_IDS = [
  'css-transitions/hover-lift',
  'css-keyframes/bounce-in',
  'waapi/bounce-in',
  'motion-react-basics/bounce-in-spring',
  'easing-math/lerp',
  'spring-physics/spring-step',
  'tailwind-basics/hover-transition',
  'tailwind-custom/theme-pulse',
  'raf-tweening/first-loop',
  'motion-core/first-animate',
  'easing-timing/overshoot-bezier',
  'easing-timing/snappy-ease',
  'transforms-3d/card-flip',
  'svg-animation/line-draw',
  'scroll-driven/scroll-progress',
  'accessibility/reduced-motion-swap',
  'interruption-state/reversible-hover',
] as const;

describe('vertical slice coverage', () => {
  it('keeps every slice challenge in the registry', () => {
    for (const id of SLICE_IDS) {
      expect(challengeRegistry.byId.has(id), `missing ${id}`).toBe(true);
    }
  });

  it('covers all three runtimes', () => {
    const runtimes = new Set(challengeRegistry.challenges.map((entry) => entry.runtime));
    expect(runtimes).toEqual(new Set(['dom', 'react', 'module']));
  });

  it('covers all three grade modes', () => {
    const modes = new Set(challengeRegistry.challenges.map((entry) => entry.gradeMode));
    expect(modes).toEqual(new Set(['auto', 'rubric', 'hybrid']));
  });

  it('ships the bounce-in series complete: three members in three distinct categories', () => {
    const members = challengeRegistry.challenges.filter((entry) => entry.series?.id === 'bounce-in');
    expect(members.map((entry) => entry.id).sort()).toEqual([
      'css-keyframes/bounce-in',
      'motion-react-basics/bounce-in-spring',
      'waapi/bounce-in',
    ]);
    expect(new Set(members.map((entry) => entry.categoryId)).size).toBe(3);
  });
});
```

These assertions stay green through Plan 06: new content adds ids without removing any, runtimes and grade modes are closed sets that remain fully covered, and `bounce-in` is capped at 3 members by the Task 1 integrity rule.

- [ ] **Step 2: Prove the test can fail (standing lesson: a test only observed passing is unproven)**

Temporarily add a bogus id (`'css-transitions/does-not-exist'`) to `SLICE_IDS`. Run `pnpm test:unit src/challenges/vertical-slice.test.ts`. Expected: FAIL with `missing css-transitions/does-not-exist`. Remove it. Then temporarily change `'react'` to `'module'` in the runtimes set. Expected: FAIL. Restore.

- [ ] **Step 3: Run the full gate one last time**

```bash
pnpm verify
pnpm build
```

Expected: both exit 0. `pnpm test:catalog` inside verify now grades 16 auto/hybrid challenges (32 grading mounts plus transpile checks) — expect roughly 30–60 seconds for the catalog project.

- [ ] **Step 4: Commit**

```bash
pnpm format
git add src/challenges/vertical-slice.test.ts
git commit -m "test(challenges): vertical-slice coverage regression"
```

---

## Definition of done

- [ ] `pnpm verify` exits 0 — including `pnpm test:catalog` with all 17 challenges.
- [ ] `pnpm build` exits 0.
- [ ] The registry holds exactly 17 challenges; `checkCatalogIntegrity` returns `[]` over the real registry, with the three new series rules active.
- [ ] Every `auto`/`hybrid` challenge: solution passes its grader, starter fails it with hinted assertions (rules 5/6, mechanically). The rubric challenge has no grader file and the gate confirms it.
- [ ] All three runtimes (`dom`, `react`, `module`) and all three grade modes appear in the registry — pinned by `vertical-slice.test.ts`.
- [ ] The `bounce-in` series is complete (3 members, 3 categories); `card-flip` and `spring-settle` each have one member.
- [ ] The `tailwind-custom/theme-pulse` solution passes rule 5 — the empirical answer to Plan 02's open question 2 (JIT-compiled `@theme` state is gradeable).
- [ ] No new dependencies; `pnpm-lock.yaml` unchanged except for nothing at all.
- [ ] No lint-disable comment, no `any`, no unsafe assertion, no `await` in loop syntax anywhere in the new code.

## What this plan deliberately excludes

| Excluded | Plan that covers it |
| --- | --- |
| The remaining ~106 challenges (all §4.1 items not in the coverage table), per-category batches | Plan 06 — Content batches |
| Completing the `card-flip`, `spring-settle`, `stagger-reveal`, `drag-dismiss`, `shared-element` series | Plan 06 — Content batches |
| Flipping category ceilings and series member counts to equality | Plan 06 — last content batch |
| Workspace UI: editor, panes, Run/Submit, rubric self-check form, series "2 of 3" display | Plan 05 — UI |
| Recording `Attempt`/`ProgressRecord` on submit; rubric confirmation persistence | Plan 04 — Data layer (records) + Plan 05 (flow) |
| Grader-authoring documentation in AGENTS.md (the rules live in this plan's contract until then) | Plan 07 — Documentation |
| Any change to the runner, sandbox harness, DSL, or TimeController (this plan only consumes them) | Plan 02 owns; regressions found here are reported, not patched ad hoc |
| Cross-engine (non-Chromium) grading tolerances | Nobody — spec §12 assumption 3 |

---

## Contract for later plans

Everything below is what Plans 05 and 06 may rely on. Plan 06 authors ~106 challenges against this section — it is the authoring manual.

### Registry state after Plan 03

17 challenges. Authored per category (slug ↔ spec §4.1 item number), and what remains for Plan 06:

| Category | Authored (§4.1 item) | Remaining items | Remaining count |
| --- | --- | --- | --- |
| css-transitions | `hover-lift` (1, Plan 01) | 2–6 | 5 |
| css-keyframes | `bounce-in` (2) | 1, 3–6 | 5 |
| transforms-3d | `card-flip` (1) | 2–6 | 5 |
| easing-timing | `snappy-ease` (1), `overshoot-bezier` (5) | 2, 3, 4, 6 | 4 |
| tailwind-basics | `hover-transition` (1) | 2–6 | 5 |
| tailwind-custom | `theme-pulse` (1) | 2–6 | 5 |
| waapi | `bounce-in` (2) | 1, 3–6 | 5 |
| raf-tweening | `first-loop` (1) | 2–7 | 6 |
| easing-math | `lerp` (1) | 2–6 | 5 |
| spring-physics | `spring-step` (2) | 1, 3, 4, 5 | 4 |
| scroll-driven | `scroll-progress` (2) | 1, 3–6 | 5 |
| motion-core | `first-animate` (1) | 2–5 | 4 |
| motion-react-basics | `bounce-in-spring` (2) | 1, 3–7 | 6 |
| motion-orchestration | — | 1–5 | 5 |
| motion-gestures | — | 1–5 | 5 |
| motion-layout | — | 1–5 | 5 |
| motion-presence | — | 1–5 | 5 |
| svg-animation | `line-draw` (1) | 2–6 | 5 |
| view-transitions | — | 1–4 | 4 |
| performance | — | 1–5 | 5 |
| accessibility | `reduced-motion-swap` (1) | 2–5 | 4 |
| interruption-state | `reversible-hover` (1) | 2–5 | 4 |

Total remaining: **106**. Series status: `bounce-in` **3/3 complete**; `card-flip` 1/3 (remaining: tailwind-basics 6, motion-react-basics 6); `spring-settle` 1/3 (remaining: easing-timing 3, motion-react-basics 7); `stagger-reveal`, `drag-dismiss`, `shared-element` 0/3.

### Grade modes and the catalog gate (authoritative interpretation)

- Rules 5/6 run for every challenge with `gradeMode !== 'rubric'`. **Hybrid graders are held to both rules**: the auto-checkable portion alone must pass on the solution AND fail on the starter. Perceptual-only goals belong in the `rubric` array, never as unassertable auto goals.
- `rubric` challenges must have NO `<slug>.grade.ts` file (the gate fails on one), a non-empty `rubric`, goals literally true of the solution, and a starter that genuinely differs.
- Content lands only when `pnpm test:catalog` is green. Budget ~1–2.5s per auto-graded challenge (two grading mounts); at the full 123 expect the spec's 2–5 minutes.

### Challenge module conventions

- File: `src/challenges/<category>/<slug>.ts` exporting `export const challenge: Challenge`. The registry glob collects it automatically; no wiring step exists. Never place helper modules in category directories (the glob would validate them as challenges); shared grader code goes in `src/sandbox/grader-utils.ts`.
- Slugs are kebab-case; `id` is exactly `<categoryId>/<slug>`. File contents (starter/solution sources) are authored as arrays of single-quoted lines `.join('\n')` — use a double-quoted line when the content contains an apostrophe or single quote.
- File-set rules (enforced statically): starter and solution declare the same file names, and differ in content. Runtime entry rules (enforced by rule 3): `module` → `index.ts` required; `react` → `App.tsx` default-exporting a plain function component; `dom` → `index.html` fragment (not a document), optional `index.ts` (required iff any script file exists), `.css` files auto-injected. SVG is inline in `index.html` — there is no `.svg` file type.
- **Goals are grader inputs.** Every goal literally true of the reference solution; every auto-checkable goal mapped to ≥1 assertion; the plan/PR for each challenge carries the goal→assertion table and an explicit audit step. Numbers stated in goals (durations, distances, frame counts) must be the same numbers the grader asserts.
- Starters must genuinely fail — and the best starters *partially* work (the overshoot starter slides but cannot overshoot; the reversible-hover starter animates in but snaps out): the failing assertions then teach the exact missing concept.
- `relatedIds` may only reference challenges already committed (the static suite runs per commit). Series members reference each other and therefore land in ONE task/commit per series, all three members together, with matching `series: { id, label }` where `label` must equal the `SERIES` definition (integrity rule) and members sit in three distinct categories.
- `hints` are progressive (concept → shape → exact code), 3 per challenge. `explanation` is markdown with `### Why this works` first, then the pitfall, then the pattern/series comparison. `estimatedMinutes`: an honest per-challenge estimate — guidance bands 5–8 novice, 10–15 intermediate, but the per-challenge value each task states is authoritative even when it exceeds its band (ratified adjudication: a genuine estimate is never clamped to the band); `graderTimeoutMs` omitted unless the grader samples frames (then `10_000`).

### Grader conventions (per pattern — copy these, they are all proven by the slice)

Common shape, every grader:

```ts
import type { GradeContext } from '@/sandbox/grade-context';

export async function grade(ctx: GradeContext): Promise<void> { /* assertions accumulate */ }
```

- `throw` only when required starter markup is missing (the user broke the fixture); otherwise record a hinted failing `ctx.expect` and `return` when later assertions would be noise (no animation found, export not a function).
- Every `hint` names the exact property/utility/API that fixes the failure.
- **Never string-compare computed transforms** — `ctx.matrix(el)` and component epsilons. For rotateY, read `m11` (= cos θ; −1 is a full flip) and `m33`. Never string-compare authored WAAPI keyframes either — assert computed state at seeked times instead (`'scale(.5)'` vs `'scale(0.5)'` is the trap).
- **No `await` in loop syntax** (lint error): sequential stepping/sampling uses `forEachStep` from `@/sandbox/grader-utils`; a handful of sequential seeks is written as straight-line statements.
- Shared helpers (`@/sandbox/grader-utils`): `forEachStep(count, action)` (re-exported from `@/sandbox/sequence`, Plan 02 — actions may resolve `false` to stop early, though no slice grader uses that), `pxNumber(value)` (parseFloat; NaN flows into failing expectClose), `numericFunction(value)` (module-lane export narrowing). Structured returns are narrowed with a local `toSnapshot`-style function using `in`/`typeof` — never `as`.
- Epsilons: positions 0.5–2px (up to 8 for long SVG offsets), scales/opacity 0.02–0.05, pure math 1e-9. Durations asserted with `===` against `timingOf(animation).duration` when the goal states an exact number; ranged (`350–850`) when the goal says "roughly".

Per-pattern exemplars (file = the template to copy):

| Pattern | Exemplar | Key moves |
| --- | --- | --- |
| CSS transition on hover | `css-transitions/hover-lift.grade.ts` (Plan 02) | `hover` → find `CSSTransition` by `transitionProperty` → `seek` mid/end |
| CSS keyframes entrance | `css-keyframes/bounce-in.grade.ts` | `hasKeyframesRule`, `CSSAnimation.animationName`, keyframe values are exact at their own offsets regardless of easing, `settle()` for end state |
| WAAPI | `waapi/bounce-in.grade.ts` | script-created animation = not `CSSAnimation`/`CSSTransition`; `timingOf().easing`; effect easing warps time — pin `linear` when goals state exact mid values |
| rAF loop | `raf-tweening/first-loop.grade.ts` | `stepFrames(n)` = exactly n frames; 15 frames = 250.0ms; assert `animations().length === 0` to pin the mechanism; ≈n−1 readings mean a TimeController regression — report, never re-tune |
| motion vanilla | `motion-core/first-animate.grade.ts` | transforms go through WAAPI → introspect + `seek`/`settle`; motion counts seconds (assert ms × 1000) |
| motion spring / react | `motion-react-basics/bounce-in-spring.grade.ts` | springs are JS-driven → `forEachStep` + `stepFrames(1)` sampling; dual `scale`/`transform` reader; `graderTimeoutMs: 10_000` |
| module lane | `easing-math/lerp.grade.ts`, `spring-physics/spring-step.grade.ts` | `numericFunction`/local snapshot narrowing; single-step constants that discriminate algorithms; mutation-of-input check |
| Tailwind utilities | `tailwind-basics/hover-transition.grade.ts` | movement via `getBoundingClientRect` deltas (v4 may use individual `translate`); transition found by `transitionProperty ∈ {transform, translate, scale, rotate}`; easing accepted as keyword or its bezier |
| Tailwind `@theme` | `tailwind-custom/theme-pulse.grade.ts` | assert post-JIT-only state (`hasKeyframesRule`, running animation); `ctx.source()` is legitimate when authoring the token IS the challenge |
| Easing curves | `easing-timing/overshoot-bezier.grade.ts` | sample several seeks around the curve peak; parse computed `cubic-bezier(…)` with a regex for control-value claims |
| 3D transforms | `transforms-3d/card-flip.grade.ts` | `m11`/`m33` reads; assert `transform-style`, `perspective`, `backface-visibility` as computed strings |
| SVG | `svg-animation/line-draw.grade.ts` | author paths with `pathLength` for round numbers; `pxNumber` on `stroke-*`; symmetric easing makes half-time reads exact |
| Scroll-driven | `scroll-driven/scroll-progress.grade.ts` | `ctx.scrollTo` at top/half/bottom of the real range; **never `seek`/`settle` a scroll-timeline animation** (percentage time); assert `animation-timeline` computed value; shorthand-order pitfall |
| Accessibility / PRM | `accessibility/reduced-motion-swap.grade.ts` | force BOTH branches explicitly via `setReducedMotion(false)` then `(true)`; re-query every element after each call (remount); single-clause PRM queries only — compound queries are answered solely from the PRM clause and must not appear in challenge CSS/JS |
| Interruption | `interruption-state/reversible-hover.grade.ts` | after retargeting, `seek(0)` reads the new transition's START value — the mechanical "no snap" proof |

### Timing and determinism rules (binding for all Plan 06 content)

- Durations 250–1200ms. `settle()` has a 3s wall cap; infinite animations are skipped by it (the theme-pulse grader simply never settles). No challenge may depend on `setTimeout`/`setInterval` for graded animation — the virtual clock does not patch timers.
- CSS/WAAPI → `seek`/`styleAt`/`settle`. rAF/motion-springs → `stepFrames` (exactly n frames of motion; start loops at mount). Scroll timelines → `scrollTo` only.
- A WAAPI/CSS animation shorter than ~800ms that must still be *running* when grading starts is safe (grade begins milliseconds after mount, and `seek` re-scrubs regardless); an animation that must not yet have been *removed* should use a `forwards`/`both` fill or a duration ≥ 800ms.

### Test files this plan added (Plan 05/06 must keep green)

- `src/challenges/integrity.test.ts` — series rules: ≤ `plannedMembers`, label matches `SERIES`, distinct categories. The equality flip (members == planned, category counts == planned, total == 123) belongs to Plan 06's LAST batch only.
- `src/challenges/vertical-slice.test.ts` — the 17 slice ids stay in the registry; all runtimes/modes covered; `bounce-in` complete. Plan 06 appends content and never edits this file except to extend `SLICE_IDS` if it wants (not required).
- `src/sandbox/grader-utils.test.ts` — helper behaviour; extend, don't fork, when adding shared grader helpers.








