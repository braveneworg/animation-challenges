import { expect, test } from 'vitest';

import { toExportsRecord } from '@/sandbox/module-exports';

test('copies namespace entries into a plain record', () => {
  expect(toExportsRecord({ a: 1, fn: 'x' })).toEqual({ a: 1, fn: 'x' });
});

test('non-objects become empty records', () => {
  expect(toExportsRecord(null)).toEqual({});
  expect(toExportsRecord(42)).toEqual({});
  expect(toExportsRecord(undefined)).toEqual({});
});
