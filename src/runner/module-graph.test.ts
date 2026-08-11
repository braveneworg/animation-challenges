import { describe, expect, test } from 'vitest';

import { collectImports, linkModuleGraph, resolveRelativeSpecifier, type LinkResult } from '@/runner/module-graph';
import type { PreparedModule } from '@/runner/types';

function assertLinked(
  result: LinkResult,
): asserts result is { ok: true; entryUrl: string; urlByPath: ReadonlyMap<string, string> } {
  if (!result.ok) throw new Error(`expected link to succeed, got: ${result.reason}`);
}

function assertLinkFailed(result: LinkResult): asserts result is { ok: false; reason: string } {
  if (result.ok) throw new Error('expected link to fail');
}

function bare(path: string, code: string): PreparedModule {
  return { path, code, imports: collectImports(code).imports };
}

describe('collectImports', () => {
  test('records static imports, re-exports, and literal dynamic imports with quote-inclusive spans', () => {
    const code = [
      "import { a } from './a';",
      "export { b } from './b';",
      "export * from './c';",
      "const lazy = () => import('./d');",
      "import 'react';",
    ].join('\n');
    const { imports, problems } = collectImports(code);
    expect(problems).toEqual([]);
    expect(imports.map((record) => record.specifier)).toEqual(['./a', './b', './c', './d', 'react']);
    const first = imports[0];
    expect(first).toBeDefined();
    expect(first && code.slice(first.start, first.end)).toBe("'./a'");
  });

  test('flags non-literal dynamic imports as problems', () => {
    const { problems } = collectImports('const path = "./x";\nconst load = () => import(path);');
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain('non-literal');
  });
});

describe('resolveRelativeSpecifier', () => {
  const paths = ['index.ts', 'helper.ts', 'ui/App.tsx', 'ui/util.js', 'styles.css'];

  test('resolves with extension guessing in order', () => {
    expect(resolveRelativeSpecifier('index.ts', './helper', paths)).toBe('helper.ts');
    expect(resolveRelativeSpecifier('index.ts', './ui/App', paths)).toBe('ui/App.tsx');
    expect(resolveRelativeSpecifier('ui/App.tsx', './util', paths)).toBe('ui/util.js');
    expect(resolveRelativeSpecifier('ui/App.tsx', '../helper.ts', paths)).toBe('helper.ts');
    expect(resolveRelativeSpecifier('index.ts', './styles.css', paths)).toBe('styles.css');
  });

  test('returns null for misses and for escapes above the root', () => {
    expect(resolveRelativeSpecifier('index.ts', './missing', paths)).toBeNull();
    expect(resolveRelativeSpecifier('index.ts', '../../evil', paths)).toBeNull();
  });
});

describe('linkModuleGraph', () => {
  function fakeCreateUrl(): ((code: string) => string) & { codeByUrl: Map<string, string> } {
    let n = 0;
    const codeByUrl = new Map<string, string>();
    const createUrl = (code: string): string => {
      n += 1;
      const url = `blob:fake/${n}`;
      codeByUrl.set(url, code);
      return url;
    };
    // Expose the map for assertions via a property on the function object.
    return Object.assign(createUrl, { codeByUrl });
  }

  test('links dependencies before dependents and rewrites relative specifiers to their urls', () => {
    const helper = bare('helper.ts', 'export const n = 1;');
    const entry = bare('index.ts', "import { n } from './helper';\nexport { n };");
    const createUrl = fakeCreateUrl();
    const result = linkModuleGraph({ modules: [entry, helper], entryPath: 'index.ts', cssPaths: [] }, createUrl);
    assertLinked(result);
    const helperUrl = result.urlByPath.get('helper.ts');
    expect(helperUrl).toBeDefined();
    const entryCode = createUrl.codeByUrl.get(result.entryUrl);
    expect(entryCode).toContain(`from '${helperUrl ?? ''}'`);
    expect(entryCode).not.toContain("'./helper'");
  });

  test('leaves bare specifiers untouched for the import map', () => {
    const entry = bare('index.ts', "import { useState } from 'react';\nvoid useState;");
    const createUrl = fakeCreateUrl();
    const result = linkModuleGraph({ modules: [entry], entryPath: 'index.ts', cssPaths: [] }, createUrl);
    assertLinked(result);
    expect(createUrl.codeByUrl.get(result.entryUrl)).toContain("'react'");
  });

  test('rewrites css imports to a shared inert module', () => {
    const entry = bare('index.ts', "import './styles.css';\nexport {};");
    const createUrl = fakeCreateUrl();
    const result = linkModuleGraph({ modules: [entry], entryPath: 'index.ts', cssPaths: ['styles.css'] }, createUrl);
    assertLinked(result);
    const entryCode = createUrl.codeByUrl.get(result.entryUrl) ?? '';
    expect(entryCode).not.toContain('./styles.css');
    expect(entryCode).toContain('blob:fake/');
  });

  test('fails on an unresolvable relative import, naming file and specifier', () => {
    const entry = bare('index.ts', "import { x } from './missing';\nvoid x;");
    const result = linkModuleGraph({ modules: [entry], entryPath: 'index.ts', cssPaths: [] }, fakeCreateUrl());
    assertLinkFailed(result);
    expect(result.reason).toContain('index.ts');
    expect(result.reason).toContain('./missing');
  });

  test('fails on a cycle, naming the members', () => {
    const a = bare('a.ts', "import { b } from './b';\nexport const a = 1;\nvoid b;");
    const b = bare('b.ts', "import { a } from './a';\nexport const b = 2;\nvoid a;");
    const result = linkModuleGraph({ modules: [a, b], entryPath: 'a.ts', cssPaths: [] }, fakeCreateUrl());
    assertLinkFailed(result);
    expect(result.reason).toContain('circular');
    expect(result.reason).toContain('a.ts');
    expect(result.reason).toContain('b.ts');
  });

  test('fails when the entry path is not among the modules', () => {
    const result = linkModuleGraph({ modules: [], entryPath: 'index.ts', cssPaths: [] }, fakeCreateUrl());
    assertLinkFailed(result);
    expect(result.reason).toContain('index.ts');
  });
});
