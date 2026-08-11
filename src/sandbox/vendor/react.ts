// One stable URL for the import map in dev AND build, and one shared React instance between the
// harness and user blob modules (both resolve to this module's underlying chunk). User code must
// use NAMED imports — `import React from 'react'` is unsupported: no default is re-exported.
//
// Deviation from the plan's `export * from 'react'`: React's package is CJS (index.js does
// `module.exports = require(dynamicPath)`), which trips two independent failures —
// `@types/react` types the module as `export = React`, so TypeScript rejects `export *`
// (TS2498: "uses 'export =' and cannot be used with 'export *'"); and Vite's dev-server import
// analysis explicitly refuses to interop `export * from` on a CJS dependency (it only rewrites
// individual named specifiers), so the re-export would silently carry zero members at runtime.
// Vite's own warning for this exact case suggests the fix applied here: enumerate the named
// exports explicitly. The list below is every member `react@19.2.8`'s CJS build assigns AND that
// `@types/react` declares (three internal/experimental names — the two `__..._DO_NOT_USE...`
// members and `unstable_useCacheRefresh` — are omitted because @types/react does not type them).
// Re-derive this list from `node_modules/react/cjs/react.development.js` if react is ever upgraded.
//
// Note: this named re-export ALSO produced a zero-export production chunk until
// `build.rollupOptions.preserveEntrySignatures: 'strict'` was added in vite.config.ts — Rolldown
// otherwise tree-shakes every export of an entry chunk nothing else in the build graph imports,
// since these vendor entries are reached only through the import map at runtime.
export {
  act,
  Activity,
  cache,
  cacheSignal,
  captureOwnerStack,
  Children,
  cloneElement,
  Component,
  createContext,
  createElement,
  createRef,
  forwardRef,
  Fragment,
  isValidElement,
  lazy,
  memo,
  Profiler,
  PureComponent,
  startTransition,
  StrictMode,
  Suspense,
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} from 'react';
