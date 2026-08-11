import { afterEach, expect, test } from 'vitest';

import { TranspilerClient } from '@/runner/transpiler-client';
import type { PreparedSubmission, PrepareResult, TranspileDiagnostic } from '@/runner/types';
import { prepareResponseSchema } from '@/runner/worker-protocol';

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

test('dispose rejects an in-flight prepare', async () => {
  client = new TranspilerClient();
  const pending = client.prepare({ 'index.ts': 'export const marker = "alpha";\n' }, 'module');
  client.dispose();
  await expect(pending).rejects.toThrow('transpiler client disposed');
});

test('prepare after dispose rejects immediately', async () => {
  client = new TranspilerClient();
  client.dispose();
  await expect(client.prepare({ 'index.ts': 'export const marker = "alpha";\n' }, 'module')).rejects.toThrow(
    'TranspilerClient is disposed',
  );
});

test('worker best-effort settles a malformed request that still carries a requestId', async () => {
  const worker = new Worker(new URL('./transpile.worker.ts', import.meta.url), { type: 'module' });
  try {
    const response = await new Promise<unknown>((resolve, reject) => {
      worker.addEventListener('message', (event: MessageEvent) => {
        resolve(event.data);
      });
      worker.addEventListener('error', (event: ErrorEvent) => {
        reject(new Error(event.message));
      });
      // `files` should be a Record<string, string>; a string value fails `prepareRequestSchema`
      // even though `requestId` is present and well-formed.
      worker.postMessage({ requestId: 1, files: 'not-a-record', runtime: 'module' });
    });
    const parsed = prepareResponseSchema.safeParse(response);
    if (!parsed.success) throw new Error('worker did not send a well-formed PrepareResponse');
    expect(parsed.data.requestId).toBe(1);
    expect(parsed.data.result.ok).toBe(false);
  } finally {
    worker.terminate();
  }
});
