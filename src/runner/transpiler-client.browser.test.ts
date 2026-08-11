import { afterEach, expect, test } from 'vitest';

import { TranspilerClient } from '@/runner/transpiler-client';
import type { PreparedSubmission, PrepareResult, TranspileDiagnostic } from '@/runner/types';

let client: TranspilerClient | null = null;

afterEach(() => {
  client?.dispose();
  client = null;
});

function assertOk(result: PrepareResult): asserts result is { ok: true; submission: PreparedSubmission } {
  if (!result.ok)
    throw new Error(`expected prepare to succeed: ${result.diagnostics.map((d) => d.message).join('; ')}`);
}

function assertFailed(
  result: PrepareResult,
): asserts result is { ok: false; diagnostics: readonly TranspileDiagnostic[] } {
  if (result.ok) throw new Error('expected prepare to fail');
}

test('prepares TSX through the real worker', async () => {
  client = new TranspilerClient();
  const result = await client.prepare(
    { 'App.tsx': 'export default function App() {\n  return <p>hi</p>;\n}\n' },
    'react',
  );
  assertOk(result);
  expect(result.submission.entryPath).toBe('App.tsx');
  expect(result.submission.modules[0]?.code).toContain('react/jsx-runtime');
});

test('reports diagnostics for a syntax error', async () => {
  client = new TranspilerClient();
  const result = await client.prepare({ 'index.ts': 'const x: = 1;\n' }, 'module');
  assertFailed(result);
  expect(result.diagnostics.some((d) => d.path === 'index.ts')).toBe(true);
});

test('correlates concurrent requests by id', async () => {
  client = new TranspilerClient();
  const [a, b] = await Promise.all([
    client.prepare({ 'index.ts': 'export const marker = "alpha";\n' }, 'module'),
    client.prepare({ 'index.ts': 'export const marker = "beta";\n' }, 'module'),
  ]);
  assertOk(a);
  assertOk(b);
  expect(a.submission.modules[0]?.code).toContain('alpha');
  expect(b.submission.modules[0]?.code).toContain('beta');
});
