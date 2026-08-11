/**
 * Single source for the `catalog` vitest project's per-test time ceiling (spec §8.2's
 * ~2×123-mount suite). `vitest.config.ts` imports this same constant for that project's
 * `testTimeout`, and `catalog-runtime.catalog.test.ts` imports it to compute its own
 * `MAX_GRADER_TIMEOUT_MS` guard — one literal instead of two independently-maintained copies.
 */
export const CATALOG_TEST_TIMEOUT_MS = 60_000;
