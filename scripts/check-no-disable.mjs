import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_ROOTS = ['src', 'sandbox', 'server'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.js', '.mjs', '.html']);
const PATTERN = /(?:oxlint|eslint)-disable/;

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, files);
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
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
