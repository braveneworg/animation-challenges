// Deviation from the plan's `export * from 'react-dom'`: same CJS-interop limitation as
// vendor/react.ts (react-dom's index.js is `module.exports = require(dynamicPath)`) — Vite's
// dev-server import analysis refuses to interop `export * from` on a CJS dependency, so the
// re-export would carry zero members at runtime. Named re-export sidesteps it; the production
// build also needs `preserveEntrySignatures: 'strict'` in vite.config.ts, or Rolldown tree-shakes
// these exports too (see vendor/react.ts's comment for the full explanation). The list below is
// every member `react-dom@19.2.8`'s CJS build assigns AND that `@types/react-dom` declares (the
// internal `__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` member is omitted
// because @types/react-dom does not type it). Re-derive from
// node_modules/react-dom/cjs/react-dom.development.js if react-dom is ever upgraded.
export {
  createPortal,
  flushSync,
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
  requestFormReset,
  unstable_batchedUpdates,
  useFormState,
  useFormStatus,
  version,
} from 'react-dom';
