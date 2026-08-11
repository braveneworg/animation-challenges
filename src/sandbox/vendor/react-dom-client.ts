// Deviation from the plan's `export * from 'react-dom/client'`: same CJS-interop limitation as
// vendor/react.ts (react-dom/client.js is `module.exports = require(dynamicPath)`) — Vite's
// dev-server import analysis refuses to interop `export * from` on a CJS dependency, so the
// re-export would carry zero members at runtime. Named re-export sidesteps it; the production
// build also needs `preserveEntrySignatures: 'strict'` in vite.config.ts, or Rolldown tree-shakes
// these exports too (see vendor/react.ts's comment for the full explanation). The CJS build also
// assigns `version`, but `@types/react-dom`'s client.d.ts does not declare it, so it is omitted
// here — consumers needing the version string use vendor/react-dom.ts instead. Re-derive from
// node_modules/react-dom/cjs/react-dom-client.development.js if react-dom is ever upgraded.
export { createRoot, hydrateRoot } from 'react-dom/client';
