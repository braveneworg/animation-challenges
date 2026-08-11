import { Component, createElement, type ComponentType, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';

export interface MountedRoot {
  unmount: () => void;
}

interface BoundaryProps {
  onError: (error: unknown) => void;
  // Optional (not `children: ReactNode`, per the brief's literal snippet): `createElement`'s props
  // argument (`{ onError }`) must alone satisfy `Attributes & BoundaryProps` — children arrives
  // separately as createElement's variadic third argument, so a REQUIRED `children` here fails
  // that overload (TS2769) even though a child is always passed at every call site. `ReactNode`
  // already includes `undefined` in its union, so this is a type-level fix only, not a behavior
  // change. `exactOptionalPropertyTypes` requires the explicit `| undefined`.
  children?: ReactNode | undefined;
}

interface BoundaryState {
  failed: boolean;
}

/** Spec §6.7: a render throw becomes an output-pane overlay message, never a dead frame. */
class SandboxErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

// zod performs the runtime check and hands back a typed value without a type assertion in our code.
// Plain function components only — the sandbox convention Plans 03/06 author against.
//
// `typeof value === 'function'` alone is NOT sufficient: a JS class's `typeof` is also 'function',
// so a class component (`class App extends Component { … }`) would slip through unrejected — the
// exact loophole flagged in review, since this mount is the only enforcement point for the
// "App.tsx default-exports a plain function component" convention (the prepare pipeline can only
// check file presence statically). At this repo's build target (tsconfig `target: es2023`,
// `erasableSyntaxOnly`), class declarations/expressions are never down-transpiled to function
// factories, so `Function.prototype.toString` reliably starts with the literal `class` keyword for
// every class and never for a plain function or arrow function — a standard, dependency-free class
// detector. `memo`/`forwardRef` exotic components and `undefined` (missing default) are already
// excluded by the `typeof` check, since neither is a function value.
const componentSchema = z.custom<ComponentType>(
  (value) => typeof value === 'function' && !value.toString().startsWith('class'),
);

/**
 * Mounts the user's `App.tsx` default export into `container` under an error boundary.
 * Throws (with a teaching message) if the export is not a plain function component.
 */
export function mountReactComponent(
  container: HTMLElement,
  componentExport: unknown,
  onError: (error: unknown) => void,
): MountedRoot {
  const parsed = componentSchema.safeParse(componentExport);
  if (!parsed.success) {
    throw new Error('App.tsx must default-export a plain function component (`export default function App() { … }`)');
  }
  const root = createRoot(container);
  // Called outside any event handler, React's default scheduling would defer the initial commit
  // to a later scheduler task instead of flushing it before this function returns (confirmed: in
  // this repo's Vitest/Playwright browser environment, that task lands after one
  // requestAnimationFrame but before a setTimeout(0) macrotask). flushSync makes mount
  // deterministic — the harness can screenshot or probe the DOM the instant this call returns.
  flushSync(() => {
    root.render(createElement(SandboxErrorBoundary, { onError }, createElement(parsed.data)));
  });
  return {
    unmount: (): void => {
      root.unmount();
    },
  };
}
