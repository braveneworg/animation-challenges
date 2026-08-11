/// <reference types="vite/client" />

// `@tailwindcss/browser` ships no type declarations (no "types" field in package.json, no bundled
// .d.ts) — src/sandbox/tailwind-loader.ts imports it only for its side effects and never touches
// an export, so an empty ambient module declaration is sufficient here.
declare module '@tailwindcss/browser';
