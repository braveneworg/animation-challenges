# Animation Challenges — Design Spec

**Date:** 2026-08-09
**Status:** Approved
**Branch:** `feat/animation-challenges-platform` (`main` intentionally left unborn)

---

## 1. Purpose

A local-first web application for practising web animation. It presents a catalog of
hand-authored challenges spanning pure CSS, Tailwind CSS v4, the Web Animations API,
`requestAnimationFrame`, pure TypeScript animation math, SVG, scroll-driven animation,
the View Transitions API, and motion.dev (both vanilla and React). The user reads a
prompt, writes a solution in an in-browser editor, submits it, and gets graded feedback.
Progress is tracked per challenge and per category. When stuck, the user reveals a
reference solution with a written explanation of why it is correct.

The audience spans novice to expert; every category ladders in difficulty.

### Success criteria

1. A user can open a challenge, write a solution, submit it, and receive feedback that
   is specific enough to act on without reading the reference solution.
2. Progress survives a browser restart, and honestly distinguishes clean solves from
   solves that followed a reveal.
3. Every reference solution in the catalog passes its own grader, and every starter
   fails it — enforced by an automated test, not by review.
4. The app is usable on a phone, including editing.
5. The app runs offline with no CDN dependency.

### Non-goals

- Multi-user accounts, authentication, or server-side identity. One implicit local user.
- Being a security sandbox against hostile code. See §6.7.
- Grading aesthetics automatically. See §2.

---

## 2. The central design decision: tiered grading

Animation correctness is only partly machine-checkable. "Make this card spring in with a
satisfying overshoot" has many correct implementations and no assertion that separates
a good one from a bad one. A strict universal grader rejects correct work; a lenient one
makes "solved" meaningless.

Therefore each challenge declares its own `gradeMode`:

| Mode | Meaning |
| --- | --- |
| `auto` | Passes purely on programmatic assertions. Used where the answer is objectively checkable: easing math, spring solvers, rAF timing, compositor-property discipline, keyframe structure, reduced-motion handling, playback control. |
| `rubric` | No assertions. The user sees their output beside the live target and confirms a structured checklist. Used where the requirement is perceptual. |
| `hybrid` | Must pass assertions *and* confirm the rubric. Used where part of the requirement is machine-checkable (e.g. "animate only `transform`/`opacity`") and part is perceptual. |

The UI always shows which mode graded a pass, so "solved" never overclaims.

---

## 3. Architecture

A single Vite SPA plus a JSON Server process for durable progress. Not a monorepo: one
deployable, one mock API.

### 3.1 Two Vite entry points

- `index.html` — the application.
- `sandbox.html` — the execution frame, built as a real second entry.

The sandbox being a real entry (rather than a `srcdoc` blob) means the runtime harness
and all graders are ordinary type-checked TypeScript that Vite code-splits. The rejected
alternative — stringifying grader functions over `postMessage` — silently breaks any
grader that references an import, and cannot be type-checked or unit-tested.

### 3.2 Directory layout

```
src/
  app/           providers, router, root layout, theme
  components/ui/ shadcn primitives
  features/
    catalog/     browse, filter, search
    workspace/   the challenge-solving screen
    progress/    dashboard and stats
    settings/
  challenges/    the content: one typed module per challenge
    types.ts
    categories.ts
    registry.ts  (import.meta.glob collection + zod validation)
    <category>/<slug>.ts
    <category>/<slug>.grade.ts
  runner/        transpile worker, module graph, iframe protocol, time control, DSL
  data/          repositories, zod schemas, api client, sync
  stores/        zustand slices
sandbox/         iframe entry: harness, grader registry, import map targets
server/          db.seed.ts, json-server config
docs/superpowers/specs/
```

### 3.3 Dependencies beyond the stated stack

Each is load-bearing:

| Addition | Justification |
| --- | --- |
| TanStack Router | Deep links to challenges and URL-encoded catalog filters; typed routes; same family as Query. |
| CodeMirror 6 | The approved editor. Small, good CSS/TS/JSX modes, themeable to match shadcn, workable on touch. |
| Sucrase | TSX→JS transform in a worker. Chosen over `esbuild-wasm`: no multi-MB wasm payload, and we transform single files rather than bundling. |
| `@tailwindcss/browser` | The only way arbitrary Tailwind classes JIT-compile inside the sandbox with no build step. |
| `motion` | App dependency and sandbox import-map entry. |
| `zod` | Validates API payloads and every challenge definition. |
| `acorn` + `magic-string` | Precise loop-guard injection. See §6.6. |
| Playwright (via Vitest browser mode) | Mandatory; see §8.1. |
| `prettier-plugin-tailwindcss` | Class sorting. |

### 3.4 Offline by construction

No CDN. React, ReactDOM, and motion are pre-bundled to ESM chunks at build time and
referenced from the sandbox import map. The app works on a plane and in CI.

### 3.5 Verified dependency versions (2026-08-09)

`typescript@7.0.2` · `react@19.2.8` · `vite@8.2.1` · `vitest@4.1.10` · `tailwindcss@4.3.3` ·
`@tailwindcss/browser@4.3.3` · `motion@13.0.0` · `eslint@10.8.1` · `prettier@3.9.6` ·
`zustand@5.0.14` · `@tanstack/react-query@5.101.4` · `react-hook-form@7.85.0` ·
`@faker-js/faker@10.5.0` · `codemirror@6.0.2` · `sucrase@3.35.1` ·
`json-server@1.0.0-beta.15`.

`json-server` has no stable 1.x; the beta is pinned exactly and kept behind
`HttpProgressRepository` so it is swappable without touching the app.

Tailwind is v4: CSS-first `@theme`, no JS config file. All Tailwind challenge content
targets v4 semantics.

---

## 4. Challenge model

```ts
type Difficulty = 'novice' | 'intermediate' | 'advanced' | 'expert';
type Tech = 'css' | 'tailwind' | 'ts' | 'react' | 'motion' | 'svg' | 'waapi';
type RuntimeKind = 'dom' | 'react' | 'module';
type GradeMode = 'auto' | 'rubric' | 'hybrid';

type ChallengeFiles = Record<string, string>; // path -> source

interface RubricItem {
  id: string;
  label: string;
  detail?: string;
}

interface Challenge {
  id: string;                    // 'css-keyframes/bounce-in'; stable, the progress key
  title: string;
  categoryId: CategoryId;
  difficulty: Difficulty;
  tech: Tech[];
  runtime: RuntimeKind;
  brief: string;                 // markdown prompt
  goals: string[];               // acceptance criteria, shown verbatim
  starter: ChallengeFiles;
  solution: ChallengeFiles;      // drives both the spoiler and the target preview
  explanation: string;           // markdown: why it works, the pitfall, the pattern
  gradeMode: GradeMode;
  rubric?: RubricItem[];         // required when gradeMode is 'rubric' or 'hybrid'
  hints: string[];               // progressive, revealed one at a time
  series?: { id: string; label: string };
  relatedIds: string[];
  estimatedMinutes: number;
  tags: string[];
  graderTimeoutMs?: number;      // default 5000
}
```

The `id` is always exactly `` `${categoryId}/${slug}` ``, which is what lets the route
`/challenges/$categoryId/$slug` reconstruct it without a lookup table.

Graders live in a sibling `<slug>.grade.ts` exporting `grade(ctx: GradeContext): Promise<void>`,
collected in the sandbox bundle by `import.meta.glob` and dynamically imported by id.

Two consequences:

- **The target preview is the reference solution, executed.** No recorded GIFs to go
  stale; the thing the user is compared against is by definition the thing the grader
  accepts.
- **`runtime: 'module'` is the pure-TypeScript lane.** The user exports a function
  (`cubicBezier`, `spring`, `damp`, `lerp`) and the grader makes numeric assertions.
  This lane is where `auto` grading is fully honest.

### 4.1 Categories and catalog manifest — 123 challenges

Difficulty in brackets: N novice, I intermediate, A advanced, X expert.
`[series]` marks membership of a cross-technique group (§4.2).

**1. `css-transitions` — Transitions & state changes (6)**
1. Hover lift: transition `transform` and `box-shadow`, never `all` [N]
2. Replace `width`/`left` animation with compositor-only properties [N]
3. Per-property durations and delays on one element [I]
4. Transition to `auto` height via the `grid-template-rows: 0fr→1fr` trick [A]
5. `transition-behavior: allow-discrete` + `@starting-style` for `display` entrances [A]
6. Interruptible hover that reverses smoothly from mid-flight [X]

**2. `css-keyframes` — `@keyframes` & the `animation` shorthand (6)**
1. Pulse loop with `@keyframes` [N]
2. Bounce-in entrance [N] `[bounce-in]`
3. `animation-fill-mode`: holding the end state [I]
4. Loading dots offset by negative `animation-delay` [I]
5. `animation-composition` layering two keyframe animations [A]
6. Pause/resume from JS via `animation-play-state` without a jump [X]

**3. `transforms-3d` — Transforms & 3D (6)**
1. Card flip with `rotateY` + `backface-visibility` [N] `[card-flip]`
2. `perspective` on the parent vs `perspective()` in the transform [I]
3. `transform-style: preserve-3d` nested faces [I]
4. `transform-origin`-driven fold/accordion [I]
5. Individual `translate`/`rotate`/`scale` properties vs the shorthand [A]
6. Pointer-tracking 3D tilt with correct matrix order [X]

**4. `easing-timing` — Timing functions (6)**
1. Swap `ease` for a `cubic-bezier` that feels snappier [N]
2. `steps()` for a typewriter/sprite effect [I]
3. `linear()` approximating a spring curve [A] `[spring-settle]`
4. Asymmetric easing: enter vs leave [I]
5. Overshoot via a control point greater than 1 [I]
6. Scale duration by distance for constant perceived velocity [X]

**5. `tailwind-basics` — Tailwind animation utilities (6)**
1. `transition`/`duration`/`ease` on hover [N]
2. `group-hover` choreography of a child [N]
3. `peer-checked` driven toggle [I]
4. `data-[state=open]` animation for a shadcn-style disclosure [I]
5. `motion-safe` / `motion-reduce` variants [I]
6. Card flip in pure Tailwind [A] `[card-flip]`

**6. `tailwind-custom` — Custom Tailwind v4 animation (6)**
1. `@theme` keyframes and an `--animate-*` token [I]
2. Arbitrary values plus inline CSS vars for per-item delay [I]
3. Reusable enter/exit animation via `@utility` [A]
4. Staggered list reveal driven by `--index` [A] `[stagger-reveal]`
5. Animation respecting both dark mode and reduced motion [A]
6. Composing animation tokens with a headless component's data attributes [X]

**7. `waapi` — Web Animations API (6)**
1. `element.animate()`: keyframes and options [N]
2. Bounce-in via WAAPI [I] `[bounce-in]`
3. Playback control: `pause`, `reverse`, `playbackRate` [I]
4. Chaining with `animation.finished` [I]
5. `composite: 'add'` for layering independent transforms [A]
6. `getAnimations()` + `commitStyles()`/`persist()` to freeze an end state [X]

**8. `raf-tweening` — `requestAnimationFrame` (7)**
1. A first rAF loop moving an element [N]
2. Delta-time correctness: frame-rate independence [I]
3. A minimal tween function with easing and completion [I]
4. Cancel and restart a tween without drift [I]
5. Staggered reveal driven by rAF [A] `[stagger-reveal]`
6. Batched reads and writes to avoid layout thrash [X]
7. Drag-to-dismiss from scratch: pointer events, rAF, velocity [A] `[drag-dismiss]`

**9. `easing-math` — Pure TypeScript easing (6, all `runtime: 'module'`)**
1. `lerp` and `inverseLerp` [N]
2. `easeInOutCubic` and the standard family [N]
3. Cubic-bezier solver with Newton-Raphson [A]
4. Frame-rate independent damping: `damp(a, b, lambda, dt)` [A]
5. Piecewise easing across multiple stops [I]
6. Range remapping with clamping [N]

**10. `spring-physics` — Pure TypeScript springs (5, all `runtime: 'module'`)**
1. Analytic underdamped spring position [A]
2. Numeric integrator with a fixed timestep [I] `[spring-settle]`
3. Derive stiffness and damping from duration and bounce [X]
4. Rest detection: when is a spring done? [I]
5. Resume a spring from a current velocity [X]

**11. `scroll-driven` — Scroll-linked animation (6)**
1. `IntersectionObserver` reveal-on-enter [N]
2. CSS `scroll-timeline` progress bar [I]
3. `view-timeline` enter/exit animation [A]
4. Tuning `animation-range` [A]
5. Parallax without jank, compositor only [A]
6. Feature-detected JS fallback for scroll-driven animation [X]

**12. `motion-core` — motion.dev, vanilla (5)**
1. `animate()` an element [N]
2. Sequences with relative offsets [I]
3. `stagger()` across a NodeList [I]
4. `scroll()` linking animation to scroll progress [A]
5. Controls: pause, complete, reverse, speed [I]

**13. `motion-react-basics` — motion.dev in React (7)**
1. `motion.div` with `initial`/`animate` [N]
2. Bounce-in with a spring transition [N] `[bounce-in]`
3. Variants across a parent/child tree [I]
4. `useAnimate` + scope for imperative sequences [A]
5. `useMotionValue` + `useTransform` mapping [A]
6. Card flip with motion [I] `[card-flip]`
7. Tuning a spring: stiffness/damping/mass vs duration/bounce [A] `[spring-settle]`

**14. `motion-orchestration` — Choreography (5)**
1. `staggerChildren` and `delayChildren` [I]
2. Staggered list reveal with variants [I] `[stagger-reveal]`
3. `when: 'beforeChildren'` vs `'afterChildren'` [A]
4. Dynamic variants via the `custom` prop [A]
5. An exit sequence that reverses the enter [X]

**15. `motion-gestures` — Gestures (5)**
1. `whileHover` and `whileTap` [N]
2. `drag` with constraints and elasticity [I]
3. Drag to dismiss past a velocity threshold [A] `[drag-dismiss]`
4. `useDragControls` for handle-driven drag [A]
5. Pan with snap-to-grid and momentum [X]

**16. `motion-layout` — Layout animation (5)**
1. The `layout` prop on a resizing element [I]
2. `layoutId` shared element across components [A] `[shared-element]`
3. `LayoutGroup` for sibling coordination [A]
4. Fixing distorted text and borders during layout animation [X]
5. `layout="position"` vs `"size"` vs `true` [I]

**17. `motion-presence` — Exit animation (5)**
1. `AnimatePresence` exit on unmount [N]
2. `mode="wait"` for a crossfade [I]
3. Keyed list add/remove with correct exit [I]
4. `popLayout` to avoid reflow during exit [A]
5. Exit animations that survive fast toggling [X]

**18. `svg-animation` — SVG (6)**
1. `stroke-dasharray`/`stroke-dashoffset` line drawing [N]
2. Animating a path's `d` with CSS between interpolable paths [A]
3. `offset-path` motion along a curve [I]
4. Morphing two shapes with matched point counts [X]
5. Animating gradients and filter primitives [A]
6. Coordinated multi-path draw with staggered delays [I]

**19. `view-transitions` — View Transitions API (4)**
1. `startViewTransition` on a DOM swap [I]
2. Named `view-transition-name` for a shared element [A] `[shared-element]`
3. Customising `::view-transition-old`/`-new` [A]
4. Reduced-motion handling and an unsupported-browser fallback [X]

**20. `performance` — Making it smooth (5)**
1. Diagnose and fix a layout-thrashing animation [I]
2. `will-change`: use, misuse, and cleanup [I]
3. Hand-rolled FLIP for a list reorder [X] `[shared-element]`
4. Avoid animating `box-shadow`: the pseudo-element opacity trick [A]
5. Keeping a long list's animation off the main thread [X]

**21. `accessibility` — Motion accessibility (5)**
1. `prefers-reduced-motion`: replace the motion, do not merely delete it [N]
2. A reduced-motion-aware React hook driving motion transitions [I]
3. Vestibular-safe substitution for a large parallax [A]
4. Focus management during an animated disclosure [A]
5. Respecting reduced motion in a rAF loop and in WAAPI [I]

**22. `interruption-state` — Interruption & state (5)**
1. Reversible hover that does not snap when interrupted [I]
2. Velocity-preserving handoff from drag to spring [X] `[drag-dismiss]`
3. An animation state machine for a multi-state button [A]
4. Debounce rapid state changes without dropping the final state [A]
5. Cancel in-flight WAAPI animations and resume from computed values [X]

**Total: 123.**

### 4.2 Cross-technique series

The "same animation, several ways" track is the `series` field, not a separate content
type. Each member still lives in its own category; the workspace shows "2 of 3 ways
solved" and links siblings. The explanations are written to compare against each other —
this is where depth comes from.

| Series | Members |
| --- | --- |
| `bounce-in` | css-keyframes 2 · waapi 2 · motion-react-basics 2 |
| `card-flip` | transforms-3d 1 · tailwind-basics 6 · motion-react-basics 6 |
| `stagger-reveal` | tailwind-custom 4 · raf-tweening 5 · motion-orchestration 2 |
| `drag-dismiss` | raf-tweening 7 · motion-gestures 3 · interruption-state 2 |
| `shared-element` | performance 3 (FLIP) · view-transitions 2 · motion-layout 2 |
| `spring-settle` | easing-timing 3 · spring-physics 2 · motion-react-basics 7 |

---

## 5. User experience

### 5.1 Routes

| Route | Screen |
| --- | --- |
| `/` | Dashboard: overall completion, per-category rings, continue-where-you-left-off, weakest-category suggestion |
| `/challenges` | Catalog: search plus filters for category, difficulty, tech, status, tag — all URL search params |
| `/challenges/$categoryId/$slug` | Workspace |
| `/progress` | Detailed stats, attempt history, series completion |
| `/settings` | Theme, forced reduced-motion preview, grader timeout, API base URL, reset progress |

### 5.2 Workspace layout

Desktop: three resizable panes — prompt | editor | output.

- **Prompt pane** — markdown brief, `goals` list, progressive hints accordion, spoiler button.
- **Editor pane** — file tabs, CodeMirror 6, and Reset / Clear / Run / Submit.
- **Output pane** — tabs for *Yours*, *Target*, *Side by side*, plus Console and Results.

Mobile: a segmented tab bar over one pane at a time, plus a sticky symbol toolbar above
the keyboard supplying `{ } : ; ( ) → %` and an indent key, because those characters are
buried on phone keyboards. Editing on a 390px screen is serviceable rather than pleasant;
that is the honest ceiling for any in-browser editor and the design does not pretend
otherwise.

### 5.3 Core interactions

- **Run** — mount into the preview frame only; no grading, no attempt recorded.
- **Submit** — grade in the hidden frame; record an `Attempt`; update the `ProgressRecord`.
- **Hint** — reveals one hint at a time. Hints never downgrade solve quality.
- **Spoiler** — always one click, never gated. Shows the reference solution in a read-only
  editor with the explanation beneath, and stamps `viewedSolutionAt`.
- **Clear** — resets the draft to `starter` and the record to `unsolved`, keeping attempt
  history, so a clean re-solve genuinely upgrades the record.

---

## 6. The runner and grading engine

### 6.1 Pipeline

```
Submit
  → snapshot draft files
  → Sucrase transform in a worker (jsx: automatic → react/jsx-runtime)
  → loop-guard injection (§6.6)
  → rewrite relative imports to blob URLs; bare specifiers fall through to the import map
  → mount in the hidden grading frame (separate from the live preview frame)
  → install the fake clock BEFORE user code executes
  → dynamic-import the grader by challenge id and run it
  → post structured results back
  → record Attempt, update ProgressRecord
```

Grading uses a **separate hidden frame** from the preview so that scrubbing time does not
visibly freeze what the user is watching.

### 6.2 Sandbox document

`sandbox.html` carries an import map for `react`, `react-dom`, `react-dom/client`,
`react/jsx-runtime`, `motion`, and `motion/react`, pointing at locally built ESM chunks.
`@tailwindcss/browser` is loaded only for challenges whose `tech` includes `tailwind`.

### 6.3 Message protocol

Typed and zod-validated in both directions, with a version field.

- Host → frame: `mount`, `grade`, `reset`, `replay`, `setEnvironment`
- Frame → host: `ready`, `mounted`, `console`, `error`, `graded`

`setEnvironment` must be sent **before** `mount`, because it patches globals the user's
code reads at module-evaluation time. It carries the forced `prefers-reduced-motion`
value (overriding `matchMedia` inside the frame), the virtual clock mode, and the
viewport size used for layout-sensitive assertions. `ctx.setReducedMotion(boolean)` is
the grader-side wrapper that remounts with a changed environment, which is how
accessibility challenges assert both branches in one run.

### 6.4 Deterministic time — three mechanisms

One is not enough:

- **`seek(ms)`** — enumerate `document.getAnimations()`, pause each, set `currentTime`,
  await `ready` plus a rAF tick so computed styles settle, then read. Covers CSS
  transitions, `@keyframes`, WAAPI, and the WAAPI-backed paths inside motion.
- **`stepFrames(n)`** — `requestAnimationFrame`, `performance.now`, and `Date.now` are
  patched at harness install to a virtual clock advanced 16.667ms per step. Covers
  hand-written rAF loops **and** motion's non-WAAPI paths: springs and layout animations
  do not go through WAAPI, so `seek` alone would quietly test nothing.
- **`settle()`** — await every `animation.finished` behind a wall-clock timeout, for
  end-state assertions.

### 6.5 Assertion DSL

`GradeContext` provides:

- Query: `root`, `query(sel)`, `queryAll(sel)`
- Style: `computed(el, prop)`, `styleAt(el, prop, ms)`
- Animation introspection: `animations(el?)`, `keyframesOf(anim)`, `timingOf(anim)`
- Stylesheet introspection: `cssRules()`, `hasKeyframesRule(name)`, `ruleFor(selector)`
- Interaction: `hover`, `click`, `focus`, `pointerDrag(el, path)`, `scrollTo(y)`
- Environment: `setReducedMotion(boolean)`
- Source: `source(path)` — last resort, for "must not use `left`/`top`" style constraints
- Module lane: `moduleExports` — for `runtime: 'module'` challenges, the evaluated
  exports of the user's entry file, so the grader calls the user's function directly
- `expect` — a small assertion helper producing `{ ok, message, hint, actual, expected }`

**Assertions accumulate; they do not short-circuit.** Each `ctx.expect(...)` records its
outcome on the context and returns, so a grader runs to completion and the user sees
every failing criterion at once rather than fixing them one per submit. A grader may
still `throw` for an unrecoverable precondition (a required element is absent, so later
assertions would be noise); that aborts the run and reports the throw alongside whatever
had already been recorded. The submission passes only if every recorded assertion is `ok`
and nothing threw.

**Three authoring rules, enforced in AGENTS.md:**

1. Assert observable output, not implementation — unless the challenge is explicitly
   *about* the implementation.
2. Every failed assertion carries a `hint`. The failure message is teaching material,
   not a stack trace.
3. **Never string-compare transforms.** `getComputedStyle(el).transform` yields
   `matrix(1, 0, 0, 1, 0, 20)` with browser-varying formatting. Parse with
   `new DOMMatrix(str)` and compare components against an explicit epsilon.

### 6.6 Infinite loops

A `while (true)` in a same-origin iframe shares the event loop and hangs the tab. No
`postMessage` timeout or watchdog can fire, because the host is frozen too.

Mitigation: **`acorn` parses the transformed output and `magic-string` injects a loop
guard** into every `while`, `for`, `for…of`, `for…in`, and `do…while` body, throwing a
recognisable `LoopGuardError` past **1,000,000 iterations for any single loop**, and past
a **50,000,000 total iteration budget per mount** to catch nested loops that individually
stay under the ceiling. Both limits are far above anything legitimate challenge code
reaches, so a trip is always a genuine runaway. This is the only approach that actually
works — regex-based injection corrupts code.

Backstop regardless of the guard: drafts autosave to localStorage debounced on every
keystroke, so a hang never costs work.

### 6.7 Error handling and threat model

| Failure | Handling |
| --- | --- |
| Transpile error | CM6 inline diagnostic with line/col; no mount |
| Runtime throw at mount | Output-pane overlay; React error boundary inside the harness |
| Grader timeout | Report which assertions had already passed; default 5000ms, per-challenge override |
| Missing `ready` handshake | Tear down and recreate the frame |
| Loop-guard trip | Surfaced as "possible infinite loop" with the offending construct |

**Threat model, stated plainly:** the frame isolates *the application* from user code —
DOM, styles, globals, React tree. It is not a security boundary. It is same-origin, so
code the user types can reach their own localStorage and their own JSON Server instance.
For a local practice tool this is the correct trade, and it is written down rather than
implied away.

---

## 7. Data and state

### 7.1 Records

```ts
interface ProgressRecord {
  id: string;                 // === challengeId
  challengeId: string;
  status: 'unsolved' | 'attempted' | 'solved';
  solveQuality: 'clean' | 'assisted' | null;  // assisted iff solution viewed before first pass
  attempts: number;
  hintsRevealed: number;
  firstSolvedAt?: string;
  lastAttemptAt?: string;
  viewedSolutionAt?: string;
  updatedAt: string;
}

interface Attempt {
  id: string;
  challengeId: string;
  createdAt: string;
  passed: boolean;
  failures: FailureSummary[];
  durationMs: number;
}

interface Note { id: string; challengeId: string; body: string; updatedAt: string }
interface Profile { id: string; displayName: string; createdAt: string }
```

### 7.2 Repository pattern

```ts
interface ProgressRepository {
  listProgress(): Promise<ProgressRecord[]>;
  upsertProgress(rec: ProgressRecord): Promise<ProgressRecord>;
  listAttempts(challengeId: string): Promise<Attempt[]>;
  addAttempt(a: Attempt): Promise<Attempt>;
  getNote(challengeId: string): Promise<Note | null>;
  saveNote(n: Note): Promise<Note>;
  getProfile(): Promise<Profile>;
}
```

Implementations: `HttpProgressRepository` (JSON Server, zod-parsed) ·
`LocalProgressRepository` (localStorage) · `MirroredProgressRepository` composing both.

**One reconciliation rule.** localStorage is the read source of truth and writes land
there synchronously. The HTTP write is fire-and-forget; a failure marks the record dirty.
On boot or reconnect, dirty records push, remote records pull, and the newest `updatedAt`
wins. Deterministic and unit-testable in isolation.

TanStack Query wraps the repository for cache invalidation, loading and error states,
optimistic submit updates, and the sync mutation. It does less here than in a typical
server application because reads resolve locally; that is a deliberate consequence of the
offline-first requirement, not an oversight.

### 7.3 Zustand

Ephemeral workspace state: per-challenge draft files, active file tab, hint index,
spoiler shown, last run result, pane sizes, theme, catalog view mode. Drafts and
preferences persist to localStorage. Frame status lives in a hook, not the store.

### 7.4 React Hook Form + Zod

Used where forms are real: the rubric self-check (checkbox array, all-required),
per-challenge notes, and settings. Catalog filters are URL search params through TanStack
Router instead, because deep-linkable filters beat form state.

### 7.5 Seeding

`pnpm seed` writes `server/db.json` with a Faker-generated demo profile and **empty
progress**. `pnpm seed --demo` additionally generates sample attempt history for
empty-state and dashboard design work. Fake solves in the real progress record would
corrupt the one thing the app exists to measure. `server/db.json` is gitignored; the seed
script is committed.

---

## 8. Testing

### 8.1 Why jsdom cannot test this app

jsdom has no layout, does not resolve animated values through `getComputedStyle`, and
does not implement the Web Animations API — so `document.getAnimations()` returns nothing
and every grader silently passes or silently fails. Anything touching the runner must run
in a real browser.

Two Vitest projects:

- **`unit`** (node): easing math, spring solvers, tween utilities, the import-graph
  rewriter, the loop-guard AST transform, reconciliation logic, repositories with mocked
  fetch, zod schemas.
- **`browser`** (Vitest browser mode, Playwright/Chromium): the harness, `TimeController`
  (`seek` and `stepFrames` correctness), the assertion DSL, and components via Testing
  Library.

### 8.2 Catalog integrity suite

The highest-value test in the project. For all 123 challenges:

1. The definition validates against the zod schema.
2. Ids are unique; `relatedIds` and `series` members all resolve.
3. `starter` and `solution` both transpile.
4. `gradeMode` of `rubric` or `hybrid` implies a non-empty `rubric`.
5. **The reference solution passes its own grader.**
6. **The starter fails its own grader.**

Rules 5 and 6 matter in both directions: the first catches broken solutions, the second
catches challenges that are accidentally pre-solved and graders that assert nothing.
Together they make a 123-challenge hand-authored catalog maintainable.

Cost is real: roughly 246 browser mounts, an estimated 2–5 minutes. It therefore runs as
a separate `pnpm test:catalog` gate rather than in the inner development loop.

### 8.3 Method

TDD per AGENTS.md: test first, watch it fail, then implement. Tests are deterministic —
the fake clock exists precisely so animation tests never depend on wall time.

---

## 9. Tooling and conventions

- **TypeScript 7.0.2** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`. No `any`.
- **ESLint 10** flat config in TypeScript: typescript-eslint strict-type-checked, react,
  react-hooks, jsx-a11y, import, perfectionist, `@vitest/eslint-plugin`, and
  `eslint-comments` with **`no-use: error`** — which mechanically enforces the "no eslint
  disable comments" rule rather than relying on discipline.
- **Prettier 3.9.6** — `printWidth: 120`, single quotes, `trailingComma: 'all'`, semicolons,
  `arrowParens: 'always'`, plus `prettier-plugin-tailwindcss`. `.prettierignore` covers
  `pnpm-lock.yaml`, `server/db.json`, `dist`, `coverage`, and generated chunks.
- **Scripts** — `dev` (vite + json-server concurrently), `dev:app`, `dev:api`, `build`,
  `preview`, `seed`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`,
  `test:unit`, `test:browser`, `test:catalog`, `verify`.
- **Commits** — Conventional Commits, atomic, on `feat/animation-challenges-platform`,
  never on `main`, no AI attribution lines.

---

## 10. Deliverables

| File | Contents |
| --- | --- |
| `README.md` | Prerequisites (corepack, Node 24 via `.nvmrc`), install, the two-process dev story, scripts table, project structure, how to add a challenge, testing, static deployment, MIT notice |
| `AGENTS.md` | Project conventions: challenge authoring guide, the three grader rules, no-`any`, no eslint-disable, TDD requirement, testing gates, commit conventions |
| `CLAUDE.md` | Thin; defers to `AGENTS.md` for everything not Claude-specific |
| `LICENSE` | MIT |

---

## 11. Implementation sequencing

The catalog is specified in full here, per the decision to write one spec. Implementation
is nonetheless ordered so that schema mistakes are cheap:

1. Scaffold, tooling, CI-able `verify` script.
2. Challenge schema, registry, and the catalog integrity harness — before content exists.
3. Runner: transpile worker, module graph, sandbox entry, protocol, `TimeController`,
   assertion DSL.
4. A vertical slice of roughly 16 challenges chosen to exercise every category shape and
   every `gradeMode`, proving the schema survives contact with CSS, Tailwind, motion,
   vanilla TS, and React alike.
5. Workspace, catalog, dashboard, settings UI.
6. Data layer and sync.
7. Bulk challenge authoring to 123, in per-category batches.
8. Documentation.

Step 4 is the schema-risk gate: a flaw found there costs 16 rewrites instead of 123.

---

## 12. Assumptions

1. Single implicit local user; no authentication.
2. The static build works standalone on localStorage, with JSON Server optional.
3. Chromium is the reference browser for grading. Graders avoid engine-specific
   assumptions where practical, but computed-style and WAAPI behaviour is verified
   against Chromium only.
