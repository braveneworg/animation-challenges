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
