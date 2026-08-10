import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { findDisableComments } from './check-no-disable.mjs';

// Split so this file never literally contains the pattern the gate bans.
const OXLINT_MARKER = ['ox', 'lint-disable-next-line'].join('');
const ESLINT_MARKER = ['es', 'lint-disable'].join('');

void test('flags disable comments in either spelling, ignores clean files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodisable-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'clean.ts'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src', 'ox.ts'), `// ${OXLINT_MARKER}\nexport const b = 2;\n`);
  writeFileSync(join(dir, 'src', 'es.ts'), `/* ${ESLINT_MARKER} */\nexport const c = 3;\n`);

  const hits = findDisableComments([join(dir, 'src')]);
  const normalized = hits
    .map((hit) => ({ file: hit.file.split('/').pop(), line: hit.line, text: hit.text }))
    .sort((a, b) => a.file.localeCompare(b.file));

  assert.deepEqual(normalized, [
    { file: 'es.ts', line: 1, text: `/* ${ESLINT_MARKER} */` },
    { file: 'ox.ts', line: 1, text: `// ${OXLINT_MARKER}` },
  ]);
  rmSync(dir, { recursive: true, force: true });
});

void test('does not descend into skipped directories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodisable-skip-'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'vendor.js'), `// ${OXLINT_MARKER}\n`);

  const hits = findDisableComments([dir]);

  assert.deepEqual(hits, []);
  rmSync(dir, { recursive: true, force: true });
});

void test('does not descend into a coverage directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodisable-coverage-'));
  mkdirSync(join(dir, 'coverage'));
  writeFileSync(join(dir, 'coverage', 'report.js'), `// ${OXLINT_MARKER}\n`);

  const hits = findDisableComments([dir]);

  assert.deepEqual(hits, []);
  rmSync(dir, { recursive: true, force: true });
});

void test('with no roots given, scans from the repository root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodisable-root-'));
  writeFileSync(join(dir, 'some.config.ts'), `// ${OXLINT_MARKER}\nexport const a = 1;\n`);
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    const hits = findDisableComments();
    assert.equal(hits.length, 1);
    assert.ok(hits[0].file.includes('some.config.ts'));
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
