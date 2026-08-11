import { expect, test } from 'vitest';

import { safeString } from '@/runner/safe-string';

test('stringifies ordinary values', () => {
  expect(safeString(42)).toBe('42');
  expect(safeString('x')).toBe('x');
  expect(safeString(null)).toBe('null');
});

test('survives a poisoned toString', () => {
  const hostile = {
    toString(): string {
      throw new Error('gotcha');
    },
  };
  expect(safeString(hostile)).toBe('[unstringifiable value]');
});
