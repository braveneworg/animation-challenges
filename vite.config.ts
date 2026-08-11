import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Stems of the sandbox vendor re-export modules (spec §3.4). The import map in sandbox.html points
// at /src/sandbox/vendor/<stem>.ts, which Vite serves directly in dev; the build rewrites those
// URLs to the stable hashless chunk names emitted below. Keep this list, the import map, and the
// vendor directory in sync — src/runner/sandbox-manifest.test.ts fails on drift.
const SANDBOX_VENDOR_STEMS = ['react', 'react-jsx-runtime', 'react-dom', 'react-dom-client', 'motion', 'motion-react'];

function sandboxImportMapPlugin(): Plugin {
  return {
    name: 'sandbox-import-map-rewrite',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.filename.endsWith('sandbox.html')) return html;
        return html.replace(/\/src\/sandbox\/vendor\/([a-z-]+)\.ts/g, '/assets/sandbox-vendor-$1.js');
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sandboxImportMapPlugin()],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // The six vendor entries below are reached only through sandbox.html's import map at
      // runtime, invisible to the bundler's own static reachability graph. Without this, Rolldown
      // tree-shakes every export of an entry chunk nothing else in the graph imports — confirmed
      // by inspecting dist/assets/sandbox-vendor-react.js, which came out with zero export
      // statements before this was added.
      preserveEntrySignatures: 'strict',
      input: {
        main: resolve(rootDir, 'index.html'),
        sandbox: resolve(rootDir, 'sandbox.html'),
        ...Object.fromEntries(
          SANDBOX_VENDOR_STEMS.map((stem) => [`vendor-${stem}`, resolve(rootDir, `src/sandbox/vendor/${stem}.ts`)]),
        ),
      },
      output: {
        // Vendor entries stay hashless: the sandbox import map references them statically.
        entryFileNames(chunk) {
          return chunk.name.startsWith('vendor-') ? 'assets/sandbox-[name].js' : 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
