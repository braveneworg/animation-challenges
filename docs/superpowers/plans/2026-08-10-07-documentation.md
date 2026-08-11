# Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four repo-root documents — `README.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md` — complete, truthful to what Plans 01–06 actually shipped, and mechanically verified against the live `package.json`; and close Plan 01's open gate-policy decision by banning `@ts-expect-error`/`@ts-ignore` alongside lint-disable comments.

**Architecture:** Documentation plus one sanctioned tooling change. Task 2 extends the disable-comment gate (`scripts/check-no-disable.mjs`) to ban the type-suppression markers, TDD-first, so the documents that describe the gate are true at the commit that introduces them. The complete text of every document is in this plan — tasks copy it verbatim, run `pnpm format` to let Prettier normalize repo-root markdown, then verify claims mechanically: a script-existence check against `package.json`, a referenced-path check, and the full `pnpm verify` gate before each commit. `README.md` is the user-facing how-to-run document, `AGENTS.md` is the contributor/agent governance file, `CLAUDE.md` is a thin Claude-specific pointer that defers to `AGENTS.md`, and `LICENSE` is MIT.

**Tech Stack:** Markdown, the standard MIT license text, and the existing `verify` chain. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-09-animation-challenges-design.md` — §10 (Deliverables: the four-file table this plan implements), §3.4 (offline by construction — the README must state it), §9 (tooling and conventions AGENTS.md distills), §2 (tiered grading — the README explains the catalog concept in its terms).

## Global Constraints

- **This plan executes LAST — after Plans 02, 03, 04, 05, and 06 have merged.** At execution time `package.json` defines exactly these 17 scripts, and the README documents all of them: `dev`, `build`, `preview`, `server`, `seed`, `typecheck`, `lint`, `lint:fix`, `lint:no-disable`, `format`, `format:check`, `test`, `test:unit`, `test:browser`, `test:catalog`, `test:scripts`, `verify` (Plan 01 shipped the base set; Plan 02 added `test:catalog` and extended `verify`; Plan 04 added `server` and `seed`). If any is missing, STOP and report — an upstream plan did not land, and this plan must not document scripts that do not exist.
- **The document texts in this plan are the deliverable.** Copy them verbatim. No placeholder sections, no "expand as needed", no paraphrasing that changes a stated fact.
- **Repo-root markdown is Prettier-formatted; `docs/superpowers/` is Prettier-ignored.** `README.md`, `AGENTS.md`, and `CLAUDE.md` must survive `pnpm format:check`. The reliable path: write the file, run `pnpm format` (it may re-pad table columns and normalize spacing — content must not change), then `pnpm format:check`. The committed bytes are the post-format output; this plan's text is the content authority, Prettier is the formatting authority. `LICENSE` has no extension, so Prettier ignores it.
- **The disable-comment gate does NOT scan `.md`.** `scripts/check-no-disable.mjs` limits itself to the extensions oxlint lints (`.ts .tsx .css .js .mjs .cjs .mts .cts .jsx .html`); `.md` is deliberately excluded. The README and AGENTS.md therefore MAY spell out `oxlint-disable` / `eslint-disable` — and, after Task 2, `@ts-expect-error` / `@ts-ignore` — when documenting the rules; the gate will not fire on any of them. Do not "fix" the gate to include `.md`.
- **`pnpm verify` green before every commit** (repo rule; the catalog project dominates the runtime — expect a few minutes at full catalog size). Commits are Conventional Commits with the `docs:` type, atomic (one per task), never on `main`, no AI attribution or `Co-authored-by` lines.
- **The repo is public (braveneworg/animation-challenges).** Never write a personal absolute path, an email that is not already public in git config, or anything secret-shaped into any of the four documents.
- **Out of scope, permanently for this plan:** CI workflows, `postinstall` hooks, dependency changes, any edit to application code or configuration. Beyond the four documents, the only files this plan touches are the gate script pair (`scripts/check-no-disable.mjs` and `scripts/check-no-disable.test.mjs`) in Task 2 — a taken policy decision from Plan 01's carried-forward list, not scope creep.

---

## Task 1: LICENSE

**Files:**

- Create: `LICENSE`

**Interfaces:**

- Consumes: `git config user.name` (read-only probe — the copyright holder's name); `package.json` `"license": "MIT"` (already set by Plan 01; verified here, not edited).
- Produces: `LICENSE` at the repo root, linked from Task 3's README (`[LICENSE](LICENSE)`).

- [ ] **Step 1: Confirm the copyright holder**

Run:

```bash
git config user.name
```

Expected output: `Michaux Kelley` (probed while writing this plan, 2026-08-11). That is the name the license text below uses.

**Implementer confirmation required:** if the command prints a different name, or the repository owner decides the GitHub org (`braveneworg`) should hold copyright instead of the individual, update the copyright line accordingly and note the change in the commit body. Do not invent a third option.

- [ ] **Step 2: Write `LICENSE`**

Exact content (the standard MIT text, year 2026):

```
MIT License

Copyright (c) 2026 Michaux Kelley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Verify `package.json` already declares MIT**

Run:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.license !== 'MIT') {
  console.error('package.json license field is ' + JSON.stringify(pkg.license) + ', expected \"MIT\"');
  process.exit(1);
}
console.log('package.json license field: MIT');
"
```

Expected: `package.json license field: MIT` (Plan 01 set it; this step only proves the LICENSE file and the manifest agree). If it fails, fix `package.json` to `"license": "MIT"` in this task and say so in the commit body.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm verify
git add LICENSE
git commit -m "docs: add MIT license"
```

Expected: `verify` green (`LICENSE` is invisible to Prettier, oxlint, and the disable gate — a failure here is pre-existing and must be reported, not worked around).

---

## Task 2: Extend the disable gate to ban `@ts-expect-error` and `@ts-ignore`

Policy decision, now taken (Plan 01's carried-forward list left it open): the type-suppression markers suppress the type system exactly as a disable comment suppresses the linter, so they get the same treatment — banned repo-wide by `pnpm lint:no-disable`. The coordinator verified that no committed plan's code uses either marker, so this breaks nothing at execution time. It runs before the documentation tasks so that the README and AGENTS.md describe a gate that already exists when they are committed.

**Files:**

- Modify: `scripts/check-no-disable.mjs` (the `PATTERN` constant, the header comment, and the two CLI messages)
- Test: `scripts/check-no-disable.test.mjs` (one new test, appended)

**Interfaces:**

- Consumes: `findDisableComments(roots?: string[])` from `scripts/check-no-disable.mjs` (Plan 01), and that file's test conventions — banned markers built by string concatenation so the test file stays clean, the `byCodePoint` comparator, `node:test` with `void test(...)`.
- Produces: the gate Tasks 3–4 document: `pnpm lint:no-disable` fails on `oxlint-disable`, `eslint-disable`, `@ts-expect-error`, and `@ts-ignore` in every linted extension; `.md` stays exempt. New CLI success message: `No banned suppression comments found.`

- [ ] **Step 1: Write the failing test**

Append to `scripts/check-no-disable.test.mjs`, next to the existing marker constants (concatenation keeps the literal banned markers out of this scanned `.mjs` file — the same trick as `OXLINT_MARKER`; note the test NAME also avoids the `@` prefix, since `PATTERN` requires `@ts-` and this file must stay clean):

```js
const TS_EXPECT_MARKER = ['@ts-expect', '-error'].join('');
const TS_IGNORE_MARKER = ['@ts-', 'ignore'].join('');
```

and, at the end of the file:

```js
void test('flags ts-expect-error and ts-ignore type-suppression comments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodisable-ts-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'expect.ts'), `// ${TS_EXPECT_MARKER} legacy shim\nexport const a = 1;\n`);
  writeFileSync(join(dir, 'src', 'ignore.ts'), `// ${TS_IGNORE_MARKER}\nexport const b = 2;\n`);

  const files = findDisableComments([join(dir, 'src')])
    .map((hit) => hit.file.split('/').pop())
    .sort(byCodePoint);

  assert.deepEqual(files, ['expect.ts', 'ignore.ts']);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run and watch it fail**

Run:

```bash
pnpm test:scripts
```

Expected: the new test FAILS — `assert.deepEqual` receives `[]` instead of `['expect.ts', 'ignore.ts']`, because the current `PATTERN` knows nothing of the ts markers. Every pre-existing test still passes.

- [ ] **Step 3: Implement — one alternation in `PATTERN`, and truthful CLI messages**

In `scripts/check-no-disable.mjs`, change:

```js
const PATTERN = /(?:oxlint|eslint)-disable/;
```

to:

```js
const PATTERN = /(?:oxlint|eslint)-disable|@ts-(?:expect-error|ignore)/;
```

**The factored form is load-bearing.** Written as `…|@ts-expect-error|@ts-ignore/`, the regex SOURCE would itself contain a literal banned marker, and the gate — which scans its own `.mjs` file — would flag its own script. In the factored form, `@ts-` is followed by `(`, so the pattern cannot match its own source line (the same self-exemption the existing `(?:oxlint|eslint)-disable` factoring already relies on).

Update the header comment above `EXTENSIONS` from:

```js
// Every extension oxlint lints and therefore honours a disable comment in. Keep `.md` out:
// the approved spec and plan quote both markers in prose.
```

to:

```js
// Every extension oxlint lints and therefore honours a disable comment in. Keep `.md` out:
// the approved specs, plans, README, and AGENTS.md quote the banned markers in prose.
```

And update the two CLI messages so they stay truthful about the wider ban:

```js
console.error('Lint-disable and type-suppression comments are not permitted in this project:\n');
```

```js
console.log('No banned suppression comments found.');
```

- [ ] **Step 4: Run the test and the repo-wide gate**

Run:

```bash
pnpm test:scripts && pnpm lint:no-disable
```

Expected: all script tests pass; the gate prints `No banned suppression comments found.` — no committed code carries either ts marker (verified before this plan was approved). If the repo-wide run DOES flag a file, the flagged code is the defect: fix its types and report the finding — never widen an exemption or revert the pattern.

- [ ] **Step 5: Mutation check (prove the new test guards the behaviour)**

Temporarily revert `PATTERN` to `/(?:oxlint|eslint)-disable/` (leave everything else in place). Run `pnpm test:scripts`. Expected: exactly the Step 1 test fails, nothing else. Restore the extended `PATTERN`, run again. Expected: green.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm verify
git add scripts/check-no-disable.mjs scripts/check-no-disable.test.mjs
git commit -m "feat(scripts): ban type-suppression comments in the disable gate"
```

Expected: `verify` green.

---

## Task 3: README.md

**Files:**

- Create: `README.md`

**Interfaces:**

- Consumes: the 17 scripts in `package.json` (Plans 01/02/04); the extended disable gate (Task 2); the served-not-`file://` constraint and `test:catalog` semantics (Plan 02's contract); the two-process dev story, `pnpm seed` semantics, and offline-by-construction (Plan 04's contract, spec §3.4); the settings/solve-quality/editor-accessibility facts (Plan 05's contract, "What Plan 07's README must document"); the equality-flip consequence for new content (Plan 06's contract); `TOTAL_PLANNED_CHALLENGES = 123`, 22 categories, 6 series (Plan 01's `src/challenges/categories.ts` and `series.ts`, pinned by the existing integrity suite); Task 1's `LICENSE`.
- Produces: `README.md` at the repo root; links to `AGENTS.md` (Task 4) and `LICENSE` (Task 1).

- [ ] **Step 1: Write `README.md`**

Exact content:

````markdown
# Animation Challenges

A practice app of 123 planned code challenges covering CSS animation, Tailwind,
[motion](https://motion.dev), and JS/TS animation techniques. You edit code in the
browser; your solution runs in a sandboxed iframe; a grader inspects real animation
state — computed styles, Web Animations API introspection, a virtual-clock
`requestAnimationFrame` — and reports per-goal results with teaching hints. Progress
lives in `localStorage`, with an optional JSON Server mirror.

The app is offline by construction: no CDN, no runtime network dependency. React,
ReactDOM, and motion are pre-bundled at build time and served from the app itself,
including inside the sandbox.

## Prerequisites

- **Node.js 24.18.0** — pinned in `.nvmrc` (`nvm use` / `fnm use` picks it up).
- **pnpm 11.21.0 via corepack** — run `corepack enable` once; the `packageManager`
  field in `package.json` selects the exact pnpm version.
- **Playwright's Chromium** — a one-time install per clone, see below.

## Install

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium
```

The Chromium install is not optional: the `browser` and `catalog` test projects run in
real Chromium, and nothing installs the browser automatically — `pnpm verify` fails
without it. There is deliberately no `postinstall` hook for this; it would tax every
install to fix a once-per-clone problem.

## Running the app

```bash
pnpm dev
```

That alone is the full experience: browse the catalog, solve challenges, and every
attempt, note, and setting persists to `localStorage`.

Optionally, mirror progress to a local JSON Server in a second terminal:

```bash
pnpm server # serves http://localhost:3001 (seeds server/db.json first if it is missing)
```

- Settings → **API base URL** points at the mirror (default `http://localhost:3001`).
  Clear the field to disable sync entirely.
- Sync runs on app boot and when the browser comes back online; pending writes flush
  when the tab is hidden or closed.
- Reads never touch the network and writes never wait on the mirror — the app stays
  fully usable with the server down.

Seeding the mirror database:

```bash
pnpm seed        # regenerate server/db.json: deterministic profile, empty progress
pnpm seed --demo # additionally: four failed sample attempts and one 'attempted'
                 # record for css-transitions/hover-lift — never a pre-solved challenge
```

## Building and deploying

```bash
pnpm build   # tsc -b, then Vite builds both entries (app + sandbox) into dist/
pnpm preview # serve the production build locally
```

**The built app must be served over http(s) — never opened from `file://`.** The
sandbox links your code into blob-URL modules; under `file://` those get an opaque
origin and every bare import fails with `Failed to fetch dynamically imported module`.
`pnpm preview` is the quickest way to run a build.

Any static file host works. Two routing requirements: unknown paths must fall back to
`/index.html` (so SPA deep links like `/challenges/css-transitions/hover-lift`
resolve), and `/sandbox.html` must be served as a real file, not swallowed by that
fallback.

Grading is developed and verified against Chromium; Chrome-family browsers are the
reference environment.

## Scripts

| Script                 | What it does                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`             | Vite dev server: the app plus the sandbox entry at `/sandbox.html`.                                             |
| `pnpm build`           | Type-check (`tsc -b`), then a production build of both entries into `dist/`.                                    |
| `pnpm preview`         | Serve `dist/` locally over http.                                                                                |
| `pnpm server`          | Seed `server/db.json` if missing, then serve the JSON Server mirror at `http://localhost:3001` (watch, CORS on). |
| `pnpm seed`            | Regenerate `server/db.json` deterministically; `--demo` adds sample failed attempts.                            |
| `pnpm typecheck`       | `tsc -b` across all project references.                                                                         |
| `pnpm lint`            | oxlint with type-aware rules.                                                                                   |
| `pnpm lint:fix`        | Same, applying safe fixes.                                                                                      |
| `pnpm lint:no-disable` | Fails on any `oxlint-disable`, `eslint-disable`, `@ts-expect-error`, or `@ts-ignore` marker in linted code.     |
| `pnpm format`          | Prettier, write mode.                                                                                           |
| `pnpm format:check`    | Prettier, check mode.                                                                                           |
| `pnpm test`            | Vitest `unit` + `browser` projects.                                                                             |
| `pnpm test:unit`       | Node-environment tests only.                                                                                    |
| `pnpm test:browser`    | Real-Chromium tests only.                                                                                       |
| `pnpm test:catalog`    | The content gate: every challenge transpiles, every solution passes its grader, every starter fails it.         |
| `pnpm test:scripts`    | `node --test` over `scripts/*.test.mjs`.                                                                        |
| `pnpm verify`          | The whole gate: typecheck, lint, no-disable check, format check, all Vitest projects, script tests.             |

## Testing

The test file name IS the environment switch:

| Pattern                                          | Vitest project    | Environment                      |
| ------------------------------------------------ | ----------------- | -------------------------------- |
| `src/**/*.test.{ts,tsx}`, `server/**/*.test.ts`  | `unit`            | Node                             |
| `src/**/*.browser.test.{ts,tsx}`                 | `browser`         | Real Chromium (Playwright)       |
| `src/**/*.catalog.test.{ts,tsx}`                 | `catalog`         | Real Chromium, 60s/test ceiling  |
| `scripts/*.test.mjs`                             | — (`node --test`) | Node                             |

`pnpm test` runs `unit` + `browser`. The `catalog` project is excluded from it and runs
via `pnpm test:catalog` (and inside `pnpm verify`): for every challenge in the registry
it proves that the starter and solution transpile, that the reference solution passes
its own grader with zero failing assertions, and that the starter genuinely fails with
hinted feedback. Budget roughly 1–2.5 seconds per auto-graded challenge — a few minutes
at full catalog size.

`pnpm verify` must be green before every commit — see [`AGENTS.md`](AGENTS.md) for the
full contribution rules.

## Project structure

```
index.html        the app entry
sandbox.html      second Vite entry: the sandboxed execution frame
src/
  app/            providers, router, layout, theme, repository + sync wiring
  features/       one directory per screen: catalog/ workspace/ progress/ settings/
  components/ui/  shadcn-style primitives
  challenges/     the content: categories, schema, registry, one typed module per
                  challenge (<category>/<slug>.ts) + its grader (<slug>.grade.ts)
  runner/         host side: transpile worker, module graph, iframe protocol, run-grade
  sandbox/        frame side: harness, virtual clock, GradeContext, vendor modules
  data/           records, repositories (local / http / mirrored), queries, storage
  stores/         zustand stores (workspace, settings)
  lib/            small utilities
  test/           browser-test setup and harnesses
server/           JSON Server seed scripts (db.json is generated, not committed)
scripts/          repo gate scripts (disable-comment check)
docs/superpowers/ design spec and implementation plans
```

## The challenge catalog

- **123 planned challenges across 22 categories** — from CSS transitions and keyframes
  through Tailwind, WAAPI, rAF tweening, spring physics, scroll-driven animation,
  motion, SVG, view transitions, performance, and accessibility. The planned counts are
  encoded in `src/challenges/categories.ts`; the catalog page always reflects what is
  actually authored.
- **Six cross-category series** — the same effect implemented in different stacks
  (for example `bounce-in` in CSS keyframes, WAAPI, and motion) so techniques can be
  compared directly.
- **Tiered grading** — each challenge declares its `gradeMode`:
  - `auto` — programmatic assertions check every goal.
  - `rubric` — you self-assess a structured checklist beside the live target; used
    where the requirement is perceptual.
  - `hybrid` — assertions check what is machine-checkable and a rubric covers the
    rest; a pass requires both.

  Every result shows which mode graded it, so "solved" never overclaims.

- **Difficulty tiers** — `novice`, `intermediate`, `advanced`, `expert`.

Progress semantics worth knowing:

- Hints and the solution spoiler never gate anything. Viewing the solution before your
  first passing submit marks the solve "assisted" rather than "clean" — a badge, not a
  lock. Revealing hints never downgrades a solve.
- The grader timeout is configurable in Settings (clamped to 1000–30000 ms); a
  challenge's own `graderTimeoutMs` always wins over the setting.
- **Reset progress** (Settings) deletes progress, attempts, notes, and profile. Your
  settings and code drafts survive it.

## Editor notes

- **Tab moves focus out of the editor.** That is deliberate keyboard-accessibility
  behaviour, not a bug. Indent with `Mod-]` / `Mod-[` (Cmd on macOS, Ctrl elsewhere) or
  the toolbar.
- On mobile, a symbol toolbar above the keyboard provides `{ } ( ) : ; => %` and indent
  controls.

## Adding a challenge

Drop `src/challenges/<category>/<slug>.ts` (exporting a `challenge` object) plus a
`<slug>.grade.ts` grader for `auto`/`hybrid` challenges — the registry, catalog,
routes, and progress tracking pick it up with **zero UI changes**. Then make
`pnpm test:catalog` pass: it mechanically rejects a challenge whose goals contradict
its solution.

The integrity suite pins the catalog to the planned counts in
`src/challenges/categories.ts` (and `series.ts`) — adding a challenge beyond them
fails the suite **by design**, and means deliberately bumping `plannedCount` (and
`plannedMembers` for a series) in the same commit.

The binding authoring rules — goals are grader inputs, starters must genuinely fail,
timing determinism — live in [`AGENTS.md`](AGENTS.md).

## License

MIT — see [`LICENSE`](LICENSE).
````

- [ ] **Step 2: Claim-check — every documented script exists in `package.json`**

Run:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const documented = [
  'dev', 'build', 'preview', 'server', 'seed',
  'typecheck', 'lint', 'lint:fix', 'lint:no-disable',
  'format', 'format:check',
  'test', 'test:unit', 'test:browser', 'test:catalog', 'test:scripts',
  'verify',
];
const missing = documented.filter((name) => typeof pkg.scripts[name] !== 'string');
if (missing.length > 0) {
  console.error('README documents scripts that package.json does not define: ' + missing.join(', '));
  process.exit(1);
}
console.log('All ' + String(documented.length) + ' documented scripts exist in package.json.');
"
```

Expected: `All 17 documented scripts exist in package.json.`

If anything is missing, an upstream plan did not land (Plan 02 owns `test:catalog`; Plan 04 owns `server` and `seed`) — STOP and report; do not delete the row from the README.

- [ ] **Step 3: Mutation-check the claim check (standing lesson: prove the check can fail)**

Re-run the Step 2 command with `'does-not-exist',` temporarily appended to the `documented` array. Expected: exit code 1 with `README documents scripts that package.json does not define: does-not-exist`. Then re-run the original Step 2 command unmodified and confirm it passes. (The mutation lives only on the command line — nothing to restore in any file.)

- [ ] **Step 4: Format and verify the file survives Prettier**

Run:

```bash
pnpm format
git diff --stat README.md
pnpm format:check
```

Expected: `format:check` passes. If `pnpm format` changed `README.md`, review the diff — table-column re-padding and list-marker normalization are fine; any change to words or numbers means a transcription error in Step 1 — fix the content, not the formatter.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm verify
git add README.md
git commit -m "docs: add README with setup, dev workflows, scripts, and catalog overview"
```

Expected: `verify` green.

---

## Task 4: AGENTS.md

**Files:**

- Create: `AGENTS.md`

**Interfaces:**

- Consumes: the toolchain rules Plan 01 established (no `any`, disable gate, `exactOptionalPropertyTypes`, no `baseUrl`, Prettier settings, version-pinning protocol); the type-suppression ban (Task 2); the test-routing conventions (Plans 01/02/04/05); the grader/catalog-gate rules and authoring manual (Plan 03's "Contract for later plans" in `docs/superpowers/plans/2026-08-10-03-vertical-slice.md`; Plan 02's grader convention; the at-scale grader patterns in Plan 06's "Contract for later plans" in `docs/superpowers/plans/2026-08-10-06-content.md`).
- Produces: `AGENTS.md` at the repo root; `CLAUDE.md` (Task 5) and `README.md` (Task 3) both point at it.

- [ ] **Step 1: Write `AGENTS.md`**

Exact content:

````markdown
# AGENTS.md

Governance for anyone — human or agent — contributing to this repository.
`CLAUDE.md` defers here for everything that is not Claude-specific. `README.md`
covers install and day-to-day usage; this file covers the rules that gate a merge.

## Workflow

- Work in a git worktree branched off `main`; never commit directly to `main`.
  Remove the worktree after its branch merges.
- `pnpm verify` must be green before **every** commit. It runs typecheck, type-aware
  lint, the disable-comment gate, the Prettier check, all Vitest projects (including
  the catalog gate), and the script tests.
- TDD is the default: write the failing test, watch it fail, then implement. Every
  feature and bug fix ships with tests.
- **Mutation-check culture:** a test that guards key behaviour must be shown to fail
  when that behaviour breaks — break it once, capture the red run, restore. A test
  that cannot fail is a defect.
- Commits are Conventional Commits, atomic. No AI attribution and no `Co-authored-by`
  lines.

## Toolchain absolutes (mechanically enforced — when a rule fires, change the code)

- **No `any`.** `typescript/no-explicit-any` is an error.
- **No lint-disable comments in any spelling** — `oxlint-disable`, `eslint-disable` —
  and no `.oxlintrc.json` `overrides` that switch a rule off. Enforced by
  `pnpm lint:no-disable` (`scripts/check-no-disable.mjs`), which scans every extension
  oxlint lints (`.ts .tsx .css .js .mjs .cjs .mts .cts .jsx .html`). `.md` is
  deliberately excluded, which is why this file can quote the markers.
- **No `@ts-expect-error` and no `@ts-ignore`.** They suppress the type system exactly
  as a disable comment suppresses the linter, and the same gate
  (`pnpm lint:no-disable`) bans them; the `.md` exemption above covers quoting them in
  documentation. If type-level testing (expect-type style) is ever adopted, this ban
  is the decision to revisit — record the exception here, do not silently carve it
  out.
- **No unsafe type assertions.** `typescript/no-unsafe-type-assertion` is on: no
  `as X` on values you don't control. Narrow `unknown` with `in`/`typeof` checks —
  `src/challenges/registry.ts` is the exemplar.
- **`exactOptionalPropertyTypes` is on.** Every optional property is declared
  `prop?: T | undefined`.
- **No `await` inside `for`/`while`** — `no-await-in-loop` is an error repo-wide.
  Sequential awaits use `forEachStep` from `src/sandbox/sequence.ts` (re-exported by
  `src/sandbox/grader-utils.ts`).
- **`vitest/no-conditional-expect`:** never `if (cond) { expect(...) }` — use a
  throwing, type-narrowing assertion helper instead.
- **`typescript/no-floating-promises`:** handle every promise; `node:test` `test()`
  calls take a `void` prefix.
- **No `baseUrl` in any tsconfig** (TypeScript 7 removed it); the `@/*` alias comes
  from `paths` alone.
- **Tailwind is v4, CSS-first.** Tokens live in `src/index.css` under `@theme`. No
  `tailwind.config.js` exists and none may be created.
- **Prettier settles style** (printWidth 120, single quotes, trailing commas,
  semicolons, import sorting). Repo-root markdown is formatted; `docs/superpowers/`
  is Prettier-ignored on purpose — approved specs and plans stay byte-stable; never
  reformat them.

## Dependencies

- The package manager is pnpm 11.21.0 via corepack, exclusively. Never `npm install`
  or `yarn`.
- Every dependency is pinned exactly — no `^`, no `~`.
- pnpm enforces `minimumReleaseAge`, so a freshly published version may be
  uninstallable. Before pinning, check `pnpm view <pkg> time --json` and pick the
  newest version at least a few days old. If `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`
  fires, step back to the newest passing version and pin that. **Never** keep a
  generated `pnpm-workspace.yaml` and never add `minimumReleaseAgeExclude` — both
  silently disable the supply-chain gate.

## Tests

The file name routes the test — there is no other switch:

| Pattern                                         | Project           | Environment                     |
| ----------------------------------------------- | ----------------- | ------------------------------- |
| `src/**/*.test.{ts,tsx}`, `server/**/*.test.ts` | `unit`            | Node                            |
| `src/**/*.browser.test.{ts,tsx}`                | `browser`         | Real Chromium (Playwright)      |
| `src/**/*.catalog.test.{ts,tsx}`                | `catalog`         | Real Chromium, 60s/test ceiling |
| `scripts/*.test.mjs`                            | — (`node --test`) | Node                            |

- A test file outside those globs does not run. If you add one, wire it into
  `pnpm verify` **and** prove it can fail before trusting it.
- `vitest.config.ts` merges `vite.config.ts` — add Vite settings in `vite.config.ts`
  only; they reach tests automatically.
- The `browser` project loads `src/test/setup.browser.ts`, which registers a global
  `afterEach(cleanup)` for React Testing Library — browser tests must NOT add their
  own. The `unit` and `catalog` projects do not load it.
- Never assert an absolute registry count or "only challenge X exists" — content
  lands continuously. Derive expected counts from
  `challengeRegistry.challenges.length`, use content-proof empty filters, and assert
  the presence of specific known entries.

## Challenge authoring

The full authoring manual is the **"Contract for later plans"** section of
`docs/superpowers/plans/2026-08-10-03-vertical-slice.md` — per-pattern grader
exemplars, epsilon tables, timing rules. Patterns added at scale — instrumentation,
API-wrapping, presence proofs, FLIP geometry, and the sanctioned raw escapes — live
in the **"Contract for later plans"** of
`docs/superpowers/plans/2026-08-10-06-content.md`. Read both before authoring. The
load-bearing rules:

- One module per challenge: `src/challenges/<category>/<slug>.ts` exporting
  `export const challenge: Challenge`. Its grader lives beside it as
  `<slug>.grade.ts`, exporting
  `export async function grade(ctx: GradeContext): Promise<void>`. The registry and
  the sandbox collect both automatically — there is no wiring step.
- `gradeMode` `auto`/`hybrid` ⇔ a grader file exists; `rubric` ⇔ no grader file.
  `pnpm test:catalog` fails on any mismatch.
- **Goals are grader inputs, not prose.** Every goal must be literally true of the
  reference solution; every auto-checkable goal maps to at least one assertion; a
  number stated in a goal is the number the grader asserts. Perceptual-only goals
  belong in `rubric`, never as unassertable auto goals.
- The catalog gate is the merge bar: starter and solution both transpile; the
  solution passes its grader with zero failing assertions, no throw, no timeout; the
  starter fails with a hinted failure. Content merges only when `pnpm test:catalog`
  is green.
- Starters must genuinely fail — and the best starters partially work, so the failing
  assertions teach exactly the missing concept.
- Every assertion's `hint` is mandatory teaching material: name the property,
  utility, or API that fixes the failure.
- Never string-compare a computed `transform` — use `ctx.matrix(el)` and component
  epsilons. Never depend on `setTimeout`/`setInterval` for graded animation — the
  virtual clock does not patch timers.
- Never place helper modules inside category directories (the registry glob would
  validate them as challenges). Shared grader helpers go in
  `src/sandbox/grader-utils.ts`.
````

- [ ] **Step 2: Claim-check the paths AGENTS.md names**

Run:

```bash
for f in \
  scripts/check-no-disable.mjs \
  src/challenges/registry.ts \
  src/sandbox/sequence.ts \
  src/sandbox/grader-utils.ts \
  src/index.css \
  src/test/setup.browser.ts \
  docs/superpowers/plans/2026-08-10-03-vertical-slice.md \
  docs/superpowers/plans/2026-08-10-06-content.md; do
  test -e "$f" || { echo "MISSING: $f"; exit 1; }
done && echo "All paths named in AGENTS.md exist."
```

Expected: `All paths named in AGENTS.md exist.` A miss means either a transcription error or an upstream plan that did not land — report, do not silently reword.

- [ ] **Step 3: Confirm the disable gate really does ignore this file**

`AGENTS.md` spells out all four banned markers — both lint-disable spellings and both type-suppression markers. Run:

```bash
pnpm lint:no-disable
```

Expected: `No banned suppression comments found.` (Task 2's message) — the gate's `EXTENSIONS` set excludes `.md`, so the markers quoted in prose are invisible to it. If it fails on `AGENTS.md`, the gate script was changed; report it — do not reword the documentation to appease a gate that this plan's Global Constraints say must not scan markdown.

- [ ] **Step 4: Format, verify, and commit**

Run:

```bash
pnpm format
pnpm format:check
pnpm verify
git add AGENTS.md
git commit -m "docs: add AGENTS.md contributor and agent governance"
```

Expected: all green. Same Prettier rule as Task 3 Step 4: whitespace normalization fine, content changes are transcription errors.

---

## Task 5: CLAUDE.md

**Files:**

- Create: `CLAUDE.md`

**Interfaces:**

- Consumes: `AGENTS.md` (Task 4) — the file it defers to; the plan-document conventions from the plans in `docs/superpowers/plans/` (every plan ends with `## Contract for later plans`; executed plans carry "Corrections applied during execution" and "Carried forward to later plans" ledgers).
- Produces: `CLAUDE.md` at the repo root.

- [ ] **Step 1: Write `CLAUDE.md`**

Per the project owner's instruction this file is SHORT: it refers to `AGENTS.md` for every non-Claude-specific detail and adds only Claude-workflow content. Exact content:

````markdown
# CLAUDE.md

Read [`AGENTS.md`](AGENTS.md) first — every binding rule for this repository
(workflow, toolchain absolutes, dependency pinning, test routing, challenge
authoring, commit conventions) lives there and is not repeated here. This file holds
only what is Claude-specific.

## Where the project documents live

- Design spec: `docs/superpowers/specs/2026-08-09-animation-challenges-design.md`.
- Implementation plans: `docs/superpowers/plans/` — numbered execution waves. Each
  plan ends with a **"Contract for later plans"** section; later work builds against
  that section, not against memory of the plan body.
- `docs/superpowers/` is Prettier-ignored: approved specs and plans are byte-stable
  artifacts. Never reformat or casually edit them.

## Plan-then-execute workflow

- Multi-task work starts with a plan written via the `superpowers:writing-plans`
  skill, saved to `docs/superpowers/plans/`, and executed with
  `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
- Ledger conventions while executing a plan:
  - A defect found in the plan's own text is fixed and recorded in the plan's
    **"Corrections applied during execution"** section.
  - An out-of-scope finding goes under **"Carried forward to later plans"**, naming
    the owning plan. Items assigned to a plan there are binding scope for it.
- Task headings in plans are `## Task N: <title>` — tooling extracts them
  mechanically. Never deviate from that shape, and never put such a heading inside a
  code fence.

Everything else is `AGENTS.md`.
````

- [ ] **Step 2: Non-duplication review**

Read `CLAUDE.md` against `AGENTS.md` and confirm no rule appears in both. Concretely: `CLAUDE.md` must not restate any of — the `any` ban, the disable-comment gate, pinning/`minimumReleaseAge`, the test-routing table, `pnpm verify` before commits, Conventional Commits, or any challenge-authoring rule. Its only overlap is naming `AGENTS.md` and the Prettier-ignore fact for `docs/superpowers/` (kept in both deliberately: in `AGENTS.md` as the formatting rule, here as the warning against editing approved artifacts). If any other rule is duplicated, delete it from `CLAUDE.md` — `AGENTS.md` wins.

- [ ] **Step 3: Claim-check the paths CLAUDE.md names**

Run:

```bash
for f in \
  AGENTS.md \
  docs/superpowers/specs/2026-08-09-animation-challenges-design.md \
  docs/superpowers/plans; do
  test -e "$f" || { echo "MISSING: $f"; exit 1; }
done && echo "All paths named in CLAUDE.md exist."
```

Expected: `All paths named in CLAUDE.md exist.`

- [ ] **Step 4: Format, verify, and commit**

Run:

```bash
pnpm format
pnpm format:check
pnpm verify
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md deferring to AGENTS.md"
```

Expected: all green.

---

## Task 6: Cross-document audit and final gate

**Files:**

- Modify: `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE` — only if this audit finds a defect; otherwise nothing.

**Interfaces:**

- Consumes: all four documents (Tasks 1, 3, 4, 5), the extended gate (Task 2), and `package.json`.
- Produces: the verified documentation set — the project's final deliverable state.

- [ ] **Step 1: Placeholder scan**

Run:

```bash
grep -nE 'TBD|TODO|FIXME|as needed|fill in|placeholder' README.md AGENTS.md CLAUDE.md LICENSE
```

Expected: no output, exit code 1 (grep found nothing). Any hit is a plan-transcription failure — fix the document content from this plan's text.

- [ ] **Step 2: Re-run every claim check together**

Run the Task 3 Step 2 script-existence check, the Task 4 Step 2 path check, and the Task 5 Step 3 path check, plus the README's own referenced paths — including every directory the Project structure tree names, since the tree is the likeliest section to rot:

```bash
for f in \
  LICENSE AGENTS.md .nvmrc \
  src/challenges/categories.ts \
  index.html sandbox.html server scripts \
  src/app src/features src/components/ui src/challenges \
  src/runner src/sandbox src/data src/stores src/lib src/test; do
  test -e "$f" || { echo "MISSING: $f"; exit 1; }
done && echo "All paths named in README.md exist."
```

Expected: every check green. (`server/db.json` is intentionally NOT in the list — the README states it is generated, and it may legitimately be absent in a fresh clone.)

- [ ] **Step 3: Cross-check the two facts most likely to rot**

1. The catalog numbers: the README says "123 planned challenges across 22 categories" and "six cross-category series". These come from Plan 01's `TOTAL_PLANNED_CHALLENGES` (derived, = 123), the 22-entry `CATEGORY_IDS`, and the 6-entry `SERIES_IDS`, and the existing integrity suite already pins all three — no new check is needed; just confirm `pnpm test` passed in the Task 3–5 `verify` runs.
2. The `verify` chain description: the README's `pnpm verify` row must list the same stages as `package.json`'s `verify` script (`typecheck && lint && lint:no-disable && format:check && test && test:catalog && test:scripts`). Compare by eye against `package.json` — they must agree stage for stage.

- [ ] **Step 4: Final full gate**

Run:

```bash
pnpm format:check
pnpm verify
```

Expected: both green with no file modified since Task 5's commit (`git status` clean apart from untracked scratch). If this audit changed any document, re-run the applicable claim checks, then commit the fixes:

```bash
git add README.md AGENTS.md CLAUDE.md LICENSE
git commit -m "docs: fix documentation audit findings"
```

If nothing changed, there is nothing to commit — this task ends with the clean `verify` run.

---

## Definition of done

- All four files exist at the repo root with the complete content from this plan (post-Prettier), and `git status` is clean.
- Spec §10's deliverables table is fully discharged: README (prerequisites with corepack and Node 24 via `.nvmrc`, install, two-process dev story, scripts table, project structure, how to add a challenge, testing, static deployment, MIT notice), AGENTS.md (authoring guide pointer + grader rules, no-`any`, no disable comments, TDD, testing gates, commit conventions), CLAUDE.md (thin, defers to AGENTS.md), LICENSE (MIT).
- Every item in Plan 05's "What Plan 07's README must document" list appears in the README: two-process dev story with `apiBaseUrl` semantics, settings semantics (timeout clamp + per-challenge precedence, reset-progress scope), solve-quality semantics, editor accessibility, `pnpm exec playwright install chromium`, served-not-`file://`.
- Plan 01's carried-forward Plan 07 item is discharged: the README instructs `pnpm exec playwright install chromium` per clone, and no `postinstall` hook was added.
- Plan 01's carried-forward `@ts-expect-error`/`@ts-ignore` policy decision is taken and enforced: the gate bans both markers, the new test proves it and was mutation-checked, the repo-wide gate run is clean, and AGENTS.md documents the ban with its revisit path.
- The README's "Adding a challenge" section states the equality-flip consequence (Plan 06's contract): content beyond the planned counts requires a deliberate `plannedCount`/`plannedMembers` bump in the same commit.
- The Task 3 script claim check passes for all 17 scripts; every path named in any document exists; `pnpm verify` and `pnpm format:check` are green.

## What this plan deliberately excludes

| Excluded | Owner |
| --- | --- |
| **CI.** Never requested by the project owner. Whoever adds it later must run `pnpm exec playwright install chromium` before any test step (the `browser` and `catalog` projects hard-require it — Plan 01/02/04 carried-forward note), then `pnpm verify`. Nothing more is pre-arranged. | Nobody — future work, on request |
| A `postinstall` hook for the Chromium install | Nobody — rejected in Plan 01: it taxes every install to fix a once-per-clone problem |
| A separate CONTRIBUTING.md | Nobody — AGENTS.md is the contributor document; a second file would drift |
| Updating README challenge counts as content lands | Nobody — the README states only the planned totals (see Contract below), so content batches never touch it |
| Flipping integrity ceilings to equality at full catalog | Plan 06 — last content batch |
| Any change to application code, configuration, or dependencies beyond Task 2's sanctioned gate extension | Not this plan; report findings instead |

## Contract for later plans

This is the final plan of the series. For any future work:

- **Where the docs live:** `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE` at the repo root. Repo-root markdown is Prettier-formatted (edit → `pnpm format` → commit); `docs/superpowers/` stays Prettier-ignored and byte-stable.
- **README counts never need content updates.** The README deliberately states only registry-derived planning facts — "123 planned challenges across 22 categories", "six cross-category series" — sourced from `src/challenges/categories.ts` / `series.ts` and pinned by the existing integrity suite. It never states an authored count, so content batches (including Plan 06's remaining work) must NOT edit the README. If the *planned* totals ever change in `categories.ts`/`series.ts`, the README's numbers and the integrity suite change in the same commit.
- **Adding a script to `package.json` obliges two README edits:** a row in the Scripts table and, if the script joins `verify`, the `pnpm verify` row's stage list. The Task 3 claim-check command (script-existence list) is the audit tool — extend its `documented` array to match.
- **`@ts-expect-error` and `@ts-ignore` are banned repo-wide**, enforced by `pnpm lint:no-disable` alongside both lint-disable spellings (`.md` exempt, so documentation may quote all four markers). The revisit path — adopting type-level, expect-type-style testing — is documented in AGENTS.md; record any future exception there, never carve it out silently.
- **Authoring rules have one home.** AGENTS.md summarizes and points to Plan 03's "Contract for later plans" as the authoring manual. If grader conventions evolve, update that contract's successor documentation and keep AGENTS.md's summary consistent — never fork the rules into a third place.
- **CLAUDE.md stays thin.** New governance goes in AGENTS.md; CLAUDE.md gains content only for genuinely Claude-specific workflow.
- **CI, when someone adds it:** install Chromium (`pnpm exec playwright install chromium`) before tests, then run `pnpm verify`. That is the entire pre-arranged requirement.
