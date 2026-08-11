// Target of Sucrase's automatic JSX runtime imports in transpiled user code.
//
// Deviation from the plan's `export * from 'react/jsx-runtime'`: same CJS-interop limitation as
// vendor/react.ts (react/jsx-runtime.js is `module.exports = require(dynamicPath)`) — Vite's
// dev-server import analysis refuses to interop `export * from` on a CJS dependency, so the
// re-export would carry zero members at runtime. Named re-export sidesteps it; the production
// build also needs `preserveEntrySignatures: 'strict'` in vite.config.ts, or Rolldown tree-shakes
// these exports too (see vendor/react.ts's comment for the full explanation). `react/jsx-runtime`
// exports exactly these three members (see node_modules/react/cjs/react-jsx-runtime.development.js).
export { Fragment, jsx, jsxs } from 'react/jsx-runtime';
