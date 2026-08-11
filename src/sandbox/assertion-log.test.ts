import { expect, test } from 'vitest';

import { AssertionLog } from '@/sandbox/assertion-log';

test('accumulates outcomes without throwing and reports allPassed', () => {
  const log = new AssertionLog();
  expect(log.record(true, { message: 'first', hint: 'h1' })).toBe(true);
  expect(log.record(false, { message: 'second', hint: 'h2', actual: 3, expected: 4 })).toBe(false);
  expect(log.record(true, { message: 'third', hint: 'h3' })).toBe(true);
  expect(log.records.length).toBe(3);
  expect(log.allPassed).toBe(false);
  expect(log.records[1]).toEqual({ ok: false, message: 'second', hint: 'h2', actual: '3', expected: '4' });
});

test('an empty log counts as all-passed (the harness separately requires at least one assertion)', () => {
  expect(new AssertionLog().allPassed).toBe(true);
});

test('stringifies hostile actual values instead of throwing', () => {
  const log = new AssertionLog();
  const hostile = {
    toString(): string {
      throw new Error('gotcha');
    },
  };
  log.record(false, { message: 'm', hint: 'h', actual: hostile });
  expect(log.records[0]?.actual).toBe('[unstringifiable value]');
});
