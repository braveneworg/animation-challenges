import { parse } from 'acorn';

import type { ImportRecord, PreparedModule } from '@/runner/types';

export interface CollectedImports {
  imports: readonly ImportRecord[];
  problems: readonly string[];
}

interface AstNode {
  type: string;
  start: number;
  end: number;
}

function isAstNode(value: unknown): value is AstNode & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number'
  );
}

function walk(value: unknown, visit: (node: AstNode & Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isAstNode(value)) return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

function readStringLiteral(value: unknown): { value: string; start: number; end: number } | null {
  if (!isAstNode(value) || value.type !== 'Literal') return null;
  const literal: unknown = value.value;
  if (typeof literal !== 'string') return null;
  return { value: literal, start: value.start, end: value.end };
}

/**
 * Scans transpiled JS for every specifier occurrence: `import … from`, side-effect `import 'x'`,
 * `export … from`, `export * from`, and literal `import('x')`. Spans include the quotes so a
 * rewrite replaces the whole literal. Non-literal dynamic imports cannot be rewritten to blob
 * URLs and are reported as problems.
 */
export function collectImports(code: string): CollectedImports {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const imports: ImportRecord[] = [];
  const problems: string[] = [];

  walk(ast, (node) => {
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration'
    ) {
      const source = readStringLiteral(node.source);
      if (source !== null) imports.push({ specifier: source.value, start: source.start, end: source.end });
      return;
    }
    if (node.type === 'ImportExpression') {
      const source = readStringLiteral(node.source);
      if (source === null) {
        problems.push('dynamic import with a non-literal specifier is not supported in the sandbox');
        return;
      }
      imports.push({ specifier: source.value, start: source.start, end: source.end });
    }
  });

  imports.sort((a, b) => a.start - b.start);
  return { imports, problems };
}

const RESOLVE_SUFFIXES: readonly string[] = ['', '.ts', '.tsx', '.js', '.jsx'];

/**
 * Resolves `./x` / `../x` against the flat virtual file map. Returns the matching path or null.
 * Segments resolving above the virtual root are a miss, never an escape.
 */
export function resolveRelativeSpecifier(
  fromPath: string,
  specifier: string,
  candidatePaths: readonly string[],
): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  const baseSegments = fromPath.split('/').slice(0, -1);
  const segments = [...baseSegments];
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  const joined = segments.join('/');
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${joined}${suffix}`;
    if (candidatePaths.includes(candidate)) return candidate;
  }
  return null;
}

export interface LinkInput {
  modules: readonly PreparedModule[];
  entryPath: string;
  cssPaths: readonly string[];
}

export type LinkResult =
  { ok: true; entryUrl: string; urlByPath: ReadonlyMap<string, string> } | { ok: false; reason: string };

const CSS_STUB_CODE = 'export {};';

/**
 * Builds the blob-URL module graph (spec §6.1): resolves every relative specifier, orders modules
 * so dependencies get URLs before their importers, rewrites relative (and css) specifiers to those
 * URLs, and leaves bare specifiers to the document import map. `createUrl` is injected so node
 * tests never need `URL.createObjectURL`.
 */
export function linkModuleGraph(input: LinkInput, createUrl: (code: string) => string): LinkResult {
  const { modules, entryPath, cssPaths } = input;
  const byPath = new Map(modules.map((module) => [module.path, module]));
  if (!byPath.has(entryPath)) {
    return { ok: false, reason: `entry module "${entryPath}" is not among the submitted files` };
  }
  const modulePaths = modules.map((module) => module.path);

  // Resolve every relative import once, up front.
  const resolved = new Map<string, Map<string, string>>(); // path -> specifier -> resolved path or css path
  for (const module of modules) {
    const bySpecifier = new Map<string, string>();
    for (const record of module.imports) {
      if (!record.specifier.startsWith('./') && !record.specifier.startsWith('../')) continue;
      const target =
        resolveRelativeSpecifier(module.path, record.specifier, modulePaths) ??
        resolveRelativeSpecifier(module.path, record.specifier, cssPaths);
      if (target === null) {
        return { ok: false, reason: `${module.path}: cannot resolve import '${record.specifier}'` };
      }
      bySpecifier.set(record.specifier, target);
    }
    resolved.set(module.path, bySpecifier);
  }

  // Kahn topological order over module→module edges (css targets are leaves handled separately).
  const inDegree = new Map<string, number>(modulePaths.map((path) => [path, 0]));
  const dependents = new Map<string, string[]>();
  for (const module of modules) {
    for (const target of (resolved.get(module.path) ?? new Map<string, string>()).values()) {
      if (!byPath.has(target)) continue; // css leaf
      inDegree.set(module.path, (inDegree.get(module.path) ?? 0) + 1);
      const list = dependents.get(target) ?? [];
      list.push(module.path);
      dependents.set(target, list);
    }
  }
  const queue = modulePaths.filter((path) => (inDegree.get(path) ?? 0) === 0).sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined) break;
    order.push(path);
    for (const dependent of dependents.get(path) ?? []) {
      const remaining = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }
  if (order.length !== modules.length) {
    const stuck = modulePaths.filter((path) => !order.includes(path)).sort();
    return { ok: false, reason: `circular imports are not supported in the sandbox: ${stuck.join(' -> ')}` };
  }

  // Create URLs in dependency order, rewriting each module's relative specifiers to the URLs made so far.
  let cssStubUrl: string | null = null;
  const urlByPath = new Map<string, string>();
  for (const path of order) {
    const module = byPath.get(path);
    if (module === undefined) continue;
    const bySpecifier = resolved.get(path) ?? new Map<string, string>();
    let code = module.code;
    for (const record of [...module.imports].sort((a, b) => b.start - a.start)) {
      const target = bySpecifier.get(record.specifier);
      if (target === undefined) continue; // bare specifier — import map's job
      let url: string;
      if (byPath.has(target)) {
        const linked = urlByPath.get(target);
        if (linked === undefined) return { ok: false, reason: `internal link error ordering "${target}"` };
        url = linked;
      } else {
        cssStubUrl = cssStubUrl ?? createUrl(CSS_STUB_CODE);
        url = cssStubUrl;
      }
      code = `${code.slice(0, record.start)}'${url}'${code.slice(record.end)}`;
    }
    urlByPath.set(path, createUrl(code));
  }

  const entryUrl = urlByPath.get(entryPath);
  if (entryUrl === undefined) return { ok: false, reason: `internal link error: no url for entry "${entryPath}"` };
  return { ok: true, entryUrl, urlByPath };
}
