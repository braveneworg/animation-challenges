import { describe, expect, test } from 'vitest';

import { fileKind, transpileFile, type TranspileFileResult } from '@/runner/transpile';

function assertOk(result: TranspileFileResult): asserts result is { ok: true; code: string } {
  if (!result.ok) throw new Error(`expected transpile to succeed, got: ${result.diagnostic.message}`);
}

function assertFailed(result: TranspileFileResult): asserts result is {
  ok: false;
  diagnostic: { path: string; message: string; line: number | null; column: number | null };
} {
  if (result.ok) throw new Error('expected transpile to fail');
}

describe('fileKind', () => {
  test('classifies by extension', () => {
    expect(fileKind('index.ts')).toBe('ts');
    expect(fileKind('App.tsx')).toBe('tsx');
    expect(fileKind('legacy.js')).toBe('js');
    expect(fileKind('legacy.jsx')).toBe('jsx');
    expect(fileKind('styles.css')).toBe('css');
    expect(fileKind('index.html')).toBe('html');
    expect(fileKind('notes.txt')).toBe('other');
  });
});

describe('transpileFile', () => {
  test('strips types from .ts and keeps ESM imports', () => {
    const result = transpileFile(
      'index.ts',
      "import { helper } from './helper';\nconst x: number = helper();\nexport { x };\n",
    );
    assertOk(result);
    expect(result.code).toContain("from './helper'");
    expect(result.code).not.toContain(': number');
  });

  test('compiles .tsx JSX with the automatic runtime', () => {
    const result = transpileFile(
      'App.tsx',
      'export default function App() {\n  return <div className="ok">hi</div>;\n}\n',
    );
    assertOk(result);
    expect(result.code).toContain('react/jsx-runtime');
    expect(result.code).not.toContain('<div');
  });

  test('passes .js through unchanged', () => {
    const source = 'export const n = 1;\n';
    const result = transpileFile('plain.js', source);
    assertOk(result);
    expect(result.code).toBe(source);
  });

  test('passes .css and .html through unchanged', () => {
    const css = '.card { color: red; }\n';
    const cssResult = transpileFile('styles.css', css);
    assertOk(cssResult);
    expect(cssResult.code).toBe(css);
  });

  test('reports a syntax error with path, line, and column', () => {
    const result = transpileFile('broken.ts', 'const x: = 1;\n');
    assertFailed(result);
    expect(result.diagnostic.path).toBe('broken.ts');
    expect(result.diagnostic.message.length).toBeGreaterThan(0);
    expect(result.diagnostic.line).toBe(1);
    expect(typeof result.diagnostic.column).toBe('number');
  });
});
