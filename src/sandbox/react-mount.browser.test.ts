import { Component, createElement, forwardRef, memo, type ReactElement } from 'react';
import { afterEach, expect, test } from 'vitest';

import { mountReactComponent, type MountedRoot } from '@/sandbox/react-mount';

let container: HTMLElement | null = null;
let mounted: MountedRoot | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  container?.remove();
  container = null;
});

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  container = el;
  return el;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

// Invokes an arbitrary value as a plain function call (no `new`) without a type assertion: TS
// statically refuses to call a constructor type directly (TS2348), so this narrows through
// `unknown` first — the same shape a real student mistake takes at runtime (misusing an unrelated
// helper class), independent of how the value is typed at the call site.
function invokeWithoutNew(target: unknown): void {
  if (typeof target === 'function') {
    target();
  }
}

test('renders a plain function component', async () => {
  const el = makeContainer();
  const App = (): ReactElement => createElement('p', { className: 'from-react' }, 'hello');
  mounted = mountReactComponent(el, App, () => undefined);
  await nextFrame();
  expect(el.querySelector('.from-react')?.textContent).toBe('hello');
});

test('a component that throws in render reports through onError instead of crashing the frame', async () => {
  const el = makeContainer();
  const errors: unknown[] = [];
  const Exploding = (): never => {
    throw new Error('render boom');
  };
  mounted = mountReactComponent(el, Exploding, (error) => {
    errors.push(error);
  });
  await nextFrame();
  expect(errors.length).toBeGreaterThan(0);
});

test('a non-function default export is rejected with a teaching message', () => {
  const el = makeContainer();
  expect(() => mountReactComponent(el, { not: 'a component' }, () => undefined)).toThrow(/App\.tsx/);
});

// A JS class's `typeof` is 'function', identical to a plain function component's — a predicate
// that only checks `typeof value === 'function'` would wrongly accept it. This is the enforcement
// point for the "App.tsx default-exports a plain function component" convention Plans 03/06
// author against (the prepare pipeline can only check file presence statically), so a class
// component MUST be rejected here, not merely a non-function value.
test('a class component default export is rejected with a teaching message', () => {
  const el = makeContainer();
  class ClassApp extends Component {
    override render(): ReactElement {
      return createElement('p', null, 'class');
    }
  }
  expect(() => mountReactComponent(el, ClassApp, () => undefined)).toThrow(/App\.tsx/);
});

test('a memo-wrapped component default export is rejected with a teaching message', () => {
  const el = makeContainer();
  const MemoApp = memo((): ReactElement => createElement('p', null, 'memo'));
  expect(() => mountReactComponent(el, MemoApp, () => undefined)).toThrow(/App\.tsx/);
});

test('a forwardRef-wrapped component default export is rejected with a teaching message', () => {
  const el = makeContainer();
  const RefApp = forwardRef((_props: object, _ref): ReactElement => createElement('p', null, 'ref'));
  expect(() => mountReactComponent(el, RefApp, () => undefined)).toThrow(/App\.tsx/);
});

test('a missing default export (undefined) is rejected with a teaching message', () => {
  const el = makeContainer();
  expect(() => mountReactComponent(el, undefined, () => undefined)).toThrow(/App\.tsx/);
});

// `SomeClass.bind(null)` defeats the static class check above: a bound function stringifies as
// `"function () { [native code] }"`, never `"class …"`, so the `.toString()` check cannot tell it
// apart from a bound plain function — this bypass is provably undetectable ahead of render.
//
// IMPORTANT — verified empirically: binding a class that `extends Component` (the coordinator's
// literal example) does NOT reproduce a bug. `class X extends Component` sets `X`'s own
// [[Prototype]] internal slot to `Component` (that's what `extends` does at the constructor-object
// level); a bound function's [[Prototype]] slot is spec'd to copy its target's, so `boundX`'s
// prototype CHAIN still resolves through `Component` — and `boundX.prototype` (a plain property
// read, not an own-property check) walks that chain to `Component.prototype`, whose
// `isReactComponent` is truthy. React's own class-vs-function detection
// (`shouldConstruct`/`createFiberFromTypeAndProps` in react-dom) reads exactly that property, not
// `hasOwnProperty`, so it still (correctly, if accidentally) constructs the bound class via `new`
// — which works, since `new` on a bound function properly forwards to the target's [[Construct]].
// Confirmed directly against `mountReactComponent`: `class extends Component {...}.bind(null)`
// renders with zero errors.
//
// The bypass is real for a class that does NOT extend anything carrying `isReactComponent` on its
// static prototype chain (no `extends React.Component`/`PureComponent`) — exactly the case below.
// There, `boundX.prototype` is genuinely `undefined` (no chain to walk), React's `shouldConstruct`
// returns false, it calls the bound class directly as a function (no `new`), and V8 throws
// `TypeError: Class constructor … cannot be invoked without 'new'`. The mount must still surface
// the teaching message through `onError` for this, not that raw TypeError.
test('a bound class component default export (not extending Component) reports the teaching message through onError', async () => {
  const el = makeContainer();
  class BareClassApp {
    render(): ReactElement {
      return createElement('p', null, 'bound bare class');
    }
  }
  const BoundBareClassApp = BareClassApp.bind(null);
  const errors: unknown[] = [];
  mounted = mountReactComponent(el, BoundBareClassApp, (error) => {
    errors.push(error);
  });
  await nextFrame();
  expect(errors).toHaveLength(1);
  const [error] = errors;
  expect(error instanceof Error && /App\.tsx/.test(error.message)).toBe(true);
});

// Over-broad-mapping regression: `normalizeRenderError` must not rewrite EVERY
// "Class constructor … cannot be invoked without 'new'" TypeError — only one whose captured class
// name matches the mounted default export's (unbound) name. Otherwise a real, unrelated student
// bug (misusing some other helper class inside an otherwise-valid function component) gets
// mislabeled as an App.tsx default-export problem, hiding the actual mistake.
test('a valid function component whose render misuses an unrelated class is NOT rewritten to the App.tsx message', async () => {
  const el = makeContainer();
  // A helper class the student's component code misuses — irrelevant to the default export.
  class NestedThing {
    value = 1;
  }
  const App = (): ReactElement => {
    invokeWithoutNew(NestedThing); // throws: "Class constructor NestedThing cannot be invoked without 'new'"
    return createElement('p', null, 'unreachable');
  };
  const errors: unknown[] = [];
  mounted = mountReactComponent(el, App, (error) => {
    errors.push(error);
  });
  await nextFrame();
  expect(errors).toHaveLength(1);
  const [error] = errors;
  expect(error instanceof Error && /NestedThing/.test(error.message)).toBe(true);
  expect(error instanceof Error && /App\.tsx/.test(error.message)).toBe(false);
});
