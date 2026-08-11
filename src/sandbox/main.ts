import { startHarness } from '@/sandbox/harness';

// DEVIATION FROM THE BRIEF'S LITERAL two-line file — documented, not a lint/type workaround.
// Under `pnpm test:browser` only, `@vitest/browser`'s dev-server plugin unconditionally rewrites
// every dynamic `import()` call in every file it serves (harness.ts's entry-module import,
// tailwind-loader.ts's `import('@tailwindcss/browser')`) into
// `globalThis["__vitest_browser_runner__"].wrapDynamicImport(() => import(...))`. That global is
// only ever installed in vitest's OWN top-level test window; this document is a same-origin but
// separately-realmed iframe (a fresh `sandbox.html` navigation), so it never receives it, and the
// dynamic import throws `TypeError: Cannot read properties of undefined (reading
// 'wrapDynamicImport')` before user code ever runs.
//
// Gated on `import.meta.env.DEV` (Vite replaces this with a literal `true`/`false` at build time,
// so Rollup's dead-code elimination strips the whole block from the production bundle — verified
// by building and grepping the output; see the task report). `pnpm test:browser` runs vitest's
// browser mode with `DEV: true`, so the shim still installs there; `pnpm dev` also has `DEV: true`
// and harmlessly keeps it; `pnpm build` + `pnpm preview` has `DEV: false`, so this never executes
// and never ships.
if (import.meta.env.DEV) {
  const dynamicImportRunnerAccessor = '__vitest_browser_runner__';
  if (!(dynamicImportRunnerAccessor in globalThis)) {
    Object.defineProperty(globalThis, dynamicImportRunnerAccessor, {
      configurable: true,
      value: { wrapDynamicImport: (moduleFactory: () => Promise<unknown>): Promise<unknown> => moduleFactory() },
    });
  }
}

startHarness(window);
