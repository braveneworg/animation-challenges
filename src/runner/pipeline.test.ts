import { describe, expect, test } from 'vitest';

import { LOOP_GUARD_FN } from '@/runner/loop-guard';
import { prepareSubmission } from '@/runner/pipeline';
import type { PreparedSubmission, PrepareResult, TranspileDiagnostic } from '@/runner/types';

function assertOk(result: PrepareResult): asserts result is { ok: true; submission: PreparedSubmission } {
  if (!result.ok)
    throw new Error(`expected prepare to succeed: ${result.diagnostics.map((d) => d.message).join('; ')}`);
}

function assertFailed(
  result: PrepareResult,
): asserts result is { ok: false; diagnostics: readonly TranspileDiagnostic[] } {
  if (result.ok) throw new Error('expected prepare to fail');
}

describe('prepareSubmission', () => {
  test('a dom challenge with only html and css prepares with no modules and no entry', () => {
    const result = prepareSubmission(
      { 'index.html': '<div class="card">x</div>', 'styles.css': '.card { color: red; }' },
      'dom',
    );
    assertOk(result);
    expect(result.submission.modules).toEqual([]);
    expect(result.submission.entryPath).toBeNull();
    expect(result.submission.htmlFile?.source).toContain('card');
    expect(result.submission.cssFiles.map((file) => file.path)).toEqual(['styles.css']);
    expect(result.submission.sources['styles.css']).toContain('color: red');
  });

  test('transpiles, loop-guards, and scans a module entry', () => {
    const result = prepareSubmission(
      {
        'index.ts':
          "import { helper } from './helper';\nexport function run(): number {\n  let n = 0;\n  for (let i = 0; i < 3; i += 1) n += helper();\n  return n;\n}\n",
        'helper.ts': 'export function helper(): number {\n  return 2;\n}\n',
      },
      'module',
    );
    assertOk(result);
    expect(result.submission.entryPath).toBe('index.ts');
    const entry = result.submission.modules.find((module) => module.path === 'index.ts');
    expect(entry?.code).toContain(LOOP_GUARD_FN);
    expect(entry?.code).not.toContain(': number');
    expect(entry?.imports.map((record) => record.specifier)).toContain('./helper');
  });

  test("runtime 'module' without index.ts is a diagnostic", () => {
    const result = prepareSubmission({ 'main.ts': 'export const x = 1;' }, 'module');
    assertFailed(result);
    expect(result.diagnostics.some((d) => d.path === 'index.ts' && d.message.includes('index.ts'))).toBe(true);
  });

  test("runtime 'react' without App.tsx is a diagnostic", () => {
    const result = prepareSubmission({ 'index.ts': 'export {};' }, 'react');
    assertFailed(result);
    expect(result.diagnostics.some((d) => d.path === 'App.tsx')).toBe(true);
  });

  test("runtime 'dom' with scripts but no index.ts is a diagnostic", () => {
    const result = prepareSubmission({ 'index.html': '<p>x</p>', 'extra.ts': 'export {};' }, 'dom');
    assertFailed(result);
    expect(result.diagnostics.some((d) => d.message.includes('index.ts'))).toBe(true);
  });

  test('accumulates every diagnostic instead of stopping at the first', () => {
    const result = prepareSubmission({ 'index.ts': 'const a: = 1;', 'other.ts': 'const b: = 2;' }, 'module');
    assertFailed(result);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
  });

  test('a dom submission with an extra .html file beyond index.html is a diagnostic', () => {
    const result = prepareSubmission({ 'index.html': '<p>x</p>', 'extra.html': '<p>y</p>' }, 'dom');
    assertFailed(result);
    expect(
      result.diagnostics.some((d) => d.path === 'extra.html' && d.message.includes('only index.html is mounted')),
    ).toBe(true);
  });

  test('an unsupported file type is a diagnostic', () => {
    const result = prepareSubmission({ 'index.html': '<p>x</p>', 'data.json': '{"a":1}' }, 'dom');
    assertFailed(result);
    expect(result.diagnostics.some((d) => d.path === 'data.json' && d.message.includes('unsupported file type'))).toBe(
      true,
    );
  });

  test('unresolvable relative imports and cycles surface as diagnostics via the link probe', () => {
    const missing = prepareSubmission({ 'index.ts': "import { x } from './nope';\nvoid x;" }, 'module');
    assertFailed(missing);
    expect(missing.diagnostics.some((d) => d.message.includes('./nope'))).toBe(true);

    const cyclic = prepareSubmission(
      {
        'index.ts': "import './a';\nexport {};",
        'a.ts': "import './b';\nexport {};",
        'b.ts': "import './a';\nexport {};",
      },
      'module',
    );
    assertFailed(cyclic);
    expect(cyclic.diagnostics.some((d) => d.message.includes('circular'))).toBe(true);
  });
});
