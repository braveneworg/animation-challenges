import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

import { buildSeedDatabase } from './seed-core.ts';

const DB_PATH = 'server/db.json';
const DEFAULT_SEED = 20_260_810;

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
