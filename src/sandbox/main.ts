import { startHarness } from '@/sandbox/harness';

// DEVIATION FROM THE BRIEF'S LITERAL two-line file — documented, not a lint/type workaround.
// Under `pnpm test:browser` only, `@vitest/browser`'s dev-server plugin unconditionally rewrites
// every dynamic `import()` call in every file it serves (harness.ts's entry-module import,
// tailwind-loader.ts's `import('@tailwindcss/browser')`) into
// `globalThis["__vitest_browser_runner__"].wrapDynamicImport(() => import(...))`. That global is
// only ever installed in vitest's OWN top-level test window; this document is a same-origin but
// separately-realmed iframe (a fresh `sandbox.html` navigation), so it never receives it, and the
// dynamic import throws `TypeError: Cannot read properties of undefined (reading
// 'wrapDynamicImport')` before user code ever runs. Outside vitest — `pnpm dev` / `pnpm build` +
// `pnpm preview` — this rewrite never happens at all, so the branch below is inert.
const dynamicImportRunnerAccessor = '__vitest_browser_runner__';
if (!(dynamicImportRunnerAccessor in globalThis)) {
  Object.defineProperty(globalThis, dynamicImportRunnerAccessor, {
    configurable: true,
    value: { wrapDynamicImport: (moduleFactory: () => Promise<unknown>): Promise<unknown> => moduleFactory() },
  });
}

startHarness(window);
