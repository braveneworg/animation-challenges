import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { findDisableComments } from './check-no-disable.mjs';

test('flags oxlint-disable and eslint-disable, ignores clean files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nodisable-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'clean.ts'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src', 'ox.ts'), '// ox' + 'lint-disable-next-line\nexport const b = 2;\n');
  writeFileSync(join(dir, 'src', 'es.ts'), '/* es' + 'lint-disable */\nexport const c = 3;\n');

  const hits = findDisableComments([join(dir, 'src')]);
  const files = hits.map((h) => h.file.split('/').pop()).sort();

  assert.deepEqual(files, ['es.ts', 'ox.ts']);
  rmSync(dir, { recursive: true, force: true });
});
