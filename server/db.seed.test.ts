import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DB_PATH } from './db.seed.ts';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const SEED_SCRIPT = join(SERVER_DIR, 'db.seed.ts');
const REAL_DB_PATH = join(SERVER_DIR, 'db.json');

describe('DB_PATH', () => {
  it('is anchored to this module, not process.cwd()', () => {
    expect(DB_PATH).toBe(REAL_DB_PATH);
  });
});

describe('node server/db.seed.ts (invoked from an unrelated cwd)', () => {
  it('writes server/db.json next to the script, never a server/db.json under the invoking cwd', () => {
    const otherCwd = mkdtempSync(join(tmpdir(), 'db-seed-cwd-'));
    try {
      const output = execFileSync(process.execPath, [SEED_SCRIPT], { cwd: otherCwd, encoding: 'utf8' });

      expect(existsSync(REAL_DB_PATH)).toBe(true);
      expect(output).toContain(REAL_DB_PATH);
      // A cwd-relative bug would have created this instead:
      expect(existsSync(join(otherCwd, 'server', 'db.json'))).toBe(false);
      expect(existsSync(join(otherCwd, 'db.json'))).toBe(false);
    } finally {
      rmSync(otherCwd, { recursive: true, force: true });
    }
  });
});
