import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

// Extends the app's real Vite config rather than restating it, so plugins, aliases, and any
// future build settings apply to tests automatically instead of having to be duplicated by hand.
// The browser project no longer declares `plugins: [react()]` of its own: `extends: true` already
// inherits React and Tailwind from the merged root, and re-adding React would apply the JSX
// transform twice. The `.tsx` browser tests below are what prove the inherited transform runs.
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
            // `.tsx` is included so a render test named `Foo.test.tsx` is collected rather than
            // silently matching no project and exiting 0. `.browser.test.tsx` is excluded here so
            // it still routes to the browser project alone.
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: [...configDefaults.exclude, 'src/**/*.browser.test.{ts,tsx}'],
          },
        },
        {
          extends: true,
          test: {
            name: 'browser',
            include: ['src/**/*.browser.test.{ts,tsx}'],
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
