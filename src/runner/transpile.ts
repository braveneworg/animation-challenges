import { transform, type Transform } from 'sucrase';

import { safeString } from '@/runner/safe-string';
import type { TranspileDiagnostic } from '@/runner/types';

export type FileKind = 'ts' | 'tsx' | 'js' | 'jsx' | 'css' | 'html' | 'other';

export type TranspileFileResult = { ok: true; code: string } | { ok: false; diagnostic: TranspileDiagnostic };

const KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  css: 'css',
  html: 'html',
};

export function fileKind(path: string): FileKind {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return KIND_BY_EXTENSION[extension] ?? 'other';
}

const TRANSFORMS_BY_KIND: Readonly<Partial<Record<FileKind, readonly Transform[]>>> = {
  ts: ['typescript'],
  tsx: ['typescript', 'jsx'],
  jsx: ['jsx'],
};

/**
 * Transpiles one file. Script kinds go through Sucrase (spec §6.1: `jsx: automatic` targets
 * `react/jsx-runtime`, which the sandbox import map resolves); css/html/other pass through
 * verbatim; plain `.js` is returned unchanged. Never throws — errors become diagnostics.
 */
export function transpileFile(path: string, source: string): TranspileFileResult {
  const transforms = TRANSFORMS_BY_KIND[fileKind(path)];
  if (transforms === undefined) return { ok: true, code: source };
  try {
    const { code } = transform(source, {
      transforms: [...transforms],
      jsxRuntime: 'automatic',
      production: true,
      disableESTransforms: true,
      filePath: path,
    });
    return { ok: true, code };
  } catch (error) {
    return { ok: false, diagnostic: toDiagnostic(path, error) };
  }
}

function toDiagnostic(path: string, error: unknown): TranspileDiagnostic {
  const message = error instanceof Error ? error.message : safeString(error);
  let line: number | null = null;
  let column: number | null = null;
  if (typeof error === 'object' && error !== null && 'loc' in error) {
    const loc: unknown = error.loc;
    if (typeof loc === 'object' && loc !== null) {
      if ('line' in loc && typeof loc.line === 'number') line = loc.line;
      if ('column' in loc && typeof loc.column === 'number') column = loc.column;
    }
  }
  return { path, message, line, column };
}
