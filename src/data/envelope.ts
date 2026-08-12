import { z } from 'zod';

import type { ParseResult } from '@/data/records';

export const CURRENT_SCHEMA_VERSION = 1;

export interface StorageEnvelope<T> {
  schemaVersion: number;
  data: T;
}

export type EnvelopeMigration = (data: unknown) => unknown;

/**
 * Migrations keyed by the schemaVersion they upgrade FROM. Empty while version 1 is current.
 * To evolve a record shape: bump CURRENT_SCHEMA_VERSION, add `[oldVersion, (data) => upgraded]`
 * here, and extend the affected schema. Existing data then upgrades on first read, without
 * key renames and without loss.
 */
export const RECORD_MIGRATIONS: ReadonlyMap<number, EnvelopeMigration> = new Map();

const envelopeSchema = z.object({
  // nonnegative, not positive: migrations key off pre-CURRENT_SCHEMA_VERSION history, and the
  // oldest recorded schema generation is 0 (see the "applies migrations from older versions"
  // test in envelope.test.ts).
  schemaVersion: z.number().int().nonnegative(),
  data: z.unknown(),
});

export function writeEnvelope(data: unknown): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data });
}

/**
 * Total reader: any corruption, unknown future version, missing/throwing migration, or
 * payload validation failure yields null ("treat as absent"). Never throws.
 */
export function readEnvelope<T>(
  raw: string | null,
  parseData: (input: unknown) => ParseResult<T>,
  migrations: ReadonlyMap<number, EnvelopeMigration> = RECORD_MIGRATIONS,
): T | null {
  if (raw === null) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return null;
  }
  const envelope = envelopeSchema.safeParse(parsedJson);
  if (!envelope.success) return null;
  let version = envelope.data.schemaVersion;
  if (version > CURRENT_SCHEMA_VERSION) return null;
  let data: unknown = envelope.data.data;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (migration === undefined) return null;
    try {
      data = migration(data);
    } catch {
      return null;
    }
    version += 1;
  }
  const result = parseData(data);
  return result.success ? result.data : null;
}
