import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { buildSeedDatabase } from './seed-core.ts';

/**
 * Anchored to this module's own file location (`import.meta.dirname`), NOT `process.cwd()` —
 * `pnpm seed`, `pnpm server`, and a direct `node server/db.seed.ts` invoked from any directory
 * all resolve to and write the same `server/db.json`, instead of silently creating a stray
 * `<cwd>/server/db.json` when invoked from elsewhere.
 */
export const DB_PATH = join(import.meta.dirname, 'db.json');
const DEFAULT_SEED = 20_260_810;

// Guards the CLI side effects (arg parsing, writing the file) so importing this module for
// `DB_PATH` — e.g. from a test — never re-runs them; mirrors scripts/check-no-disable.mjs's
// `import.meta.filename === process.argv[1]` convention for a dual test-and-CLI-entry module.
if (import.meta.filename === process.argv[1]) {
  const { values } = parseArgs({
    options: {
      demo: { type: 'boolean', default: false },
      'if-missing': { type: 'boolean', default: false },
    },
  });

  const demo = values.demo;
  const ifMissing = values['if-missing'];

  if (ifMissing && existsSync(DB_PATH)) {
    process.exit(0);
  }

  const db = buildSeedDatabase({ demo, seed: DEFAULT_SEED });
  mkdirSync(dirname(DB_PATH), { recursive: true });
  writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
  process.stdout.write(`Seeded ${DB_PATH}${demo ? ' with demo data' : ' with empty progress'}\n`);
}
