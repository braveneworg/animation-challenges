import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import { CATALOG_TEST_TIMEOUT_MS } from './src/challenges/catalog-timeouts.ts';
import viteConfig from './vite.config.ts';

// Extends the app's real Vite config rather than restating it, so plugins, aliases, and any
// future build settings apply to tests automatically instead of having to be duplicated by hand.
// The browser projects do not re-declare `plugins: [react()]`: `extends: true` already inherits
// React and Tailwind from the merged root, and re-adding React would apply the JSX transform twice.
//
// Test routing — the file name IS the environment switch:
//   *.test.{ts,tsx}          -> unit (node)
//   *.browser.test.{ts,tsx}  -> browser (Chromium; inner loop)
//   *.catalog.test.{ts,tsx}  -> catalog (Chromium; `pnpm test:catalog` / `pnpm verify` only —
//                               spec §8.2 keeps the ~2×123-mount suite out of `pnpm test`)
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
            exclude: [...configDefaults.exclude, 'src/**/*.browser.test.{ts,tsx}', 'src/**/*.catalog.test.{ts,tsx}'],
          },
        },
        {
          extends: true,
          test: {
            name: 'browser',
            include: ['src/**/*.browser.test.{ts,tsx}'],
            setupFiles: ['./src/test/setup.browser.ts'],
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
          },
        },
        {
          extends: true,
          test: {
            name: 'catalog',
            include: ['src/**/*.catalog.test.{ts,tsx}'],
            testTimeout: CATALOG_TEST_TIMEOUT_MS,
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
          },
        },
      ],
    },
  }),
);
