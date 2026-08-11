import type { ChallengeFiles, RuntimeKind } from '@/challenges/types';
import { injectLoopGuards } from '@/runner/loop-guard';
import { collectImports, linkModuleGraph } from '@/runner/module-graph';
import { fileKind, transpileFile } from '@/runner/transpile';
import type { PreparedModule, PrepareResult, SandboxFile, TranspileDiagnostic } from '@/runner/types';

function flat(path: string, message: string): TranspileDiagnostic {
  return { path, message, line: null, column: null };
}

/**
 * The pure heart of the runner (spec §6.1): Sucrase transform → loop-guard injection → import scan
 * → structural validation, with every failure accumulated as a diagnostic. Runs identically in the
 * worker, in node unit tests, and in the catalog integrity suite (rule 3: this function's `ok`).
 */
export function prepareSubmission(files: ChallengeFiles, runtime: RuntimeKind): PrepareResult {
  const diagnostics: TranspileDiagnostic[] = [];
  const modules: PreparedModule[] = [];
  const cssFiles: SandboxFile[] = [];
  let htmlFile: SandboxFile | null = null;
  let nextLoopId = 0;

  for (const path of Object.keys(files).sort()) {
    const source = files[path] ?? '';
    const kind = fileKind(path);
    if (kind === 'css') {
      cssFiles.push({ path, source });
      continue;
    }
    if (kind === 'html') {
      if (path === 'index.html') htmlFile = { path, source };
      else diagnostics.push(flat(path, 'only index.html is mounted; remove or rename extra html files'));
      continue;
    }
    if (kind === 'other') {
      diagnostics.push(flat(path, 'unsupported file type in the sandbox'));
      continue;
    }
    const transpiled = transpileFile(path, source);
    if (!transpiled.ok) {
      diagnostics.push(transpiled.diagnostic);
      continue;
    }
    const guarded = injectLoopGuards(transpiled.code, nextLoopId);
    nextLoopId += guarded.loopCount;
    const collected = collectImports(guarded.code);
    for (const problem of collected.problems) diagnostics.push(flat(path, problem));
    modules.push({ path, code: guarded.code, imports: collected.imports });
  }

  const modulePaths = modules.map((module) => module.path);
  let entryPath: string | null = null;
  if (runtime === 'module') {
    if (modulePaths.includes('index.ts')) entryPath = 'index.ts';
    else diagnostics.push(flat('index.ts', "runtime 'module' requires an index.ts entry file"));
  } else if (runtime === 'react') {
    if (modulePaths.includes('App.tsx')) entryPath = 'App.tsx';
    else
      diagnostics.push(flat('App.tsx', "runtime 'react' requires an App.tsx entry that default-exports a component"));
  } else if (modulePaths.includes('index.ts')) {
    entryPath = 'index.ts';
  } else if (modules.length > 0) {
    diagnostics.push(
      flat('index.ts', "runtime 'dom' runs script files through an index.ts entry; add one or remove the scripts"),
    );
  }

  // Probe the link (with a fake url factory) so unresolvable imports and cycles surface at prepare
  // time as editor diagnostics, not as mount failures inside the frame.
  if (diagnostics.length === 0 && entryPath !== null) {
    const probe = linkModuleGraph(
      { modules, entryPath, cssPaths: cssFiles.map((file) => file.path) },
      () => 'blob:probe',
    );
    if (!probe.ok) diagnostics.push(flat(entryPath, probe.reason));
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, submission: { modules, cssFiles, htmlFile, entryPath, sources: { ...files } } };
}
