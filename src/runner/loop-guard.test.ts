import { describe, expect, test } from 'vitest';

import { injectLoopGuards, LOOP_GUARD_FN } from '@/runner/loop-guard';

/** Runs guarded code with a counting stub in place of the runtime guard. */
function runGuarded(code: string): number {
  let calls = 0;
  const guard = (): void => {
    calls += 1;
  };
  // eslint-style dynamic evaluation is fine here: this is a node test executing our own fixture.
  const run = new Function(LOOP_GUARD_FN, code);
  run(guard);
  return calls;
}

describe('injectLoopGuards', () => {
  test('guards a for loop once per iteration', () => {
    const { code, loopCount } = injectLoopGuards('for (let i = 0; i < 5; i += 1) { void i; }', 0);
    expect(loopCount).toBe(1);
    expect(runGuarded(code)).toBe(5);
  });

  test('guards while, do-while, for-of, and for-in', () => {
    const source = [
      'let n = 0;',
      'while (n < 3) { n += 1; }',
      'do { n += 1; } while (n < 6);',
      'for (const x of [1, 2]) { void x; }',
      'for (const k in { a: 1 }) { void k; }',
    ].join('\n');
    const { code, loopCount } = injectLoopGuards(source, 0);
    expect(loopCount).toBe(4);
    expect(runGuarded(code)).toBe(3 + 3 + 2 + 1);
  });

  test('wraps non-block loop bodies in a block', () => {
    const { code } = injectLoopGuards('let n = 0;\nwhile (n < 4) n += 1;', 0);
    expect(runGuarded(code)).toBe(4);
  });

  test('guards a loop nested inside a single-statement else branch without breaking syntax', () => {
    const source = 'let n = 0;\nif (false) { n = 9; } else while (n < 2) n += 1;';
    const { code } = injectLoopGuards(source, 0);
    expect(runGuarded(code)).toBe(2);
  });

  test('numbers loops from firstLoopId and reports the count', () => {
    const { code, loopCount } = injectLoopGuards('for (let i = 0; i < 1; i += 1) {}\nwhile (false) {}', 7);
    expect(loopCount).toBe(2);
    expect(code).toContain(`${LOOP_GUARD_FN}(7)`);
    expect(code).toContain(`${LOOP_GUARD_FN}(8)`);
  });

  test('leaves loop-free code unchanged', () => {
    const source = 'const x = [1, 2].map((n) => n * 2);\nexport {};\n';
    const { code, loopCount } = injectLoopGuards(source, 0);
    expect(loopCount).toBe(0);
    expect(code).toBe(source);
  });
});
