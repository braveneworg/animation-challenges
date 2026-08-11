import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_ROOTS = ['.'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.claude', '.superpowers']);
// Every extension oxlint lints and therefore honours a disable comment in. Keep `.md` out:
// the approved spec and plan quote both markers in prose.
const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.css', '.js', '.jsx', '.mjs', '.cjs', '.html']);
const PATTERN = /(?:oxlint|eslint)-disable/;

function walk(dir, files = []) {
  let entries;
  try {
    // `withFileTypes` reports the entry's own type without a follow-up `statSync`. That matters:
    // `statSync` follows symlinks, so a dangling link throws ENOENT and a link loop throws ELOOP,
    // and neither is catchable from inside this loop — both would crash the whole gate.
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    // Symlinks are skipped outright rather than resolved: following them can loop, and anything
    // a link points at inside the repo is already reached by its real path.
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, files);
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(full);
    }
  }
  return files;
}

export function findDisableComments(roots = DEFAULT_ROOTS) {
  const hits = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, index) => {
        if (PATTERN.test(text)) hits.push({ file, line: index + 1, text: text.trim() });
      });
    }
  }
  return hits;
}

if (import.meta.filename === process.argv[1]) {
  const hits = findDisableComments();
  if (hits.length > 0) {
    console.error('Lint disable comments are not permitted in this project:\n');
    for (const hit of hits) console.error(`  ${hit.file}:${hit.line}  ${hit.text}`);
    process.exit(1);
  }
  console.log('No lint disable comments found.');
}
