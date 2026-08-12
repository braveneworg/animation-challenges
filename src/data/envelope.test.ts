import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CURRENT_SCHEMA_VERSION, readEnvelope, writeEnvelope, type EnvelopeMigration } from '@/data/envelope';
import { parseWith, type ParseResult } from '@/data/records';

const payloadSchema = z.strictObject({ value: z.string() });

function parsePayload(input: unknown): ParseResult<{ value: string }> {
  return parseWith<{ value: string }>(payloadSchema, input);
}

describe('writeEnvelope', () => {
  it('stamps the current schema version', () => {
    expect(JSON.parse(writeEnvelope({ value: 'a' }))).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: { value: 'a' },
    });
  });
});

describe('readEnvelope', () => {
  it('round-trips through writeEnvelope', () => {
    expect(readEnvelope(writeEnvelope({ value: 'a' }), parsePayload)).toEqual({ value: 'a' });
  });

  it('returns null for null, corrupt JSON, and non-envelope JSON', () => {
    expect(readEnvelope(null, parsePayload)).toBeNull();
    expect(readEnvelope('{not json', parsePayload)).toBeNull();
    expect(readEnvelope('"just a string"', parsePayload)).toBeNull();
    expect(readEnvelope('{"data":{"value":"a"}}', parsePayload)).toBeNull();
  });

  it('returns null when the payload fails validation', () => {
    expect(
      readEnvelope(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data: { value: 7 } }), parsePayload),
    ).toBeNull();
  });

  it('returns null for a schemaVersion newer than the app', () => {
    const raw = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1, data: { value: 'a' } });
    expect(readEnvelope(raw, parsePayload)).toBeNull();
  });

  it('applies migrations from older versions in order', () => {
    const migrations = new Map<number, EnvelopeMigration>([
      [0, (data) => ({ value: JSON.stringify(data).length > 0 ? 'migrated' : 'never' })],
    ]);
    const raw = JSON.stringify({ schemaVersion: 0, data: { legacy: true } });
    expect(readEnvelope(raw, parsePayload, migrations)).toEqual({ value: 'migrated' });
  });

  it('returns null when a migration is missing or throws', () => {
    const raw = JSON.stringify({ schemaVersion: 0, data: {} });
    expect(readEnvelope(raw, parsePayload, new Map())).toBeNull();
    const throwing = new Map<number, EnvelopeMigration>([
      [
        0,
        () => {
          throw new Error('boom');
        },
      ],
    ]);
    expect(readEnvelope(raw, parsePayload, throwing)).toBeNull();
  });
});
