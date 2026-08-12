import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { attemptSchema, profileSchema, progressRecordShape } from '@/data/records';

import { buildSeedDatabase, DEMO_CHALLENGE_ID } from './seed-core.ts';

const wireProgressSchema = z.strictObject(progressRecordShape);

describe('buildSeedDatabase (default)', () => {
  it('writes empty progress, attempts, and notes with a valid Faker profile', () => {
    const db = buildSeedDatabase({ demo: false, seed: 42 });
    expect(db.progress).toEqual([]);
    expect(db.attempts).toEqual([]);
    expect(db.notes).toEqual([]);
    expect(profileSchema.safeParse(db.profile).success).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    expect(buildSeedDatabase({ demo: false, seed: 42 })).toEqual(buildSeedDatabase({ demo: false, seed: 42 }));
    expect(buildSeedDatabase({ demo: true, seed: 42 })).toEqual(buildSeedDatabase({ demo: true, seed: 42 }));
  });
});

describe('buildSeedDatabase (--demo)', () => {
  const db = buildSeedDatabase({ demo: true, seed: 42 });

  it('generates schema-valid sample attempts for the real demo challenge', () => {
    expect(db.attempts.length).toBeGreaterThan(0);
    for (const attempt of db.attempts) {
      expect(attemptSchema.safeParse(attempt).success).toBe(true);
      expect(attempt.challengeId).toBe(DEMO_CHALLENGE_ID);
    }
  });

  it('NEVER fabricates a solve — attempts fail, progress stays attempted (spec §7.5)', () => {
    for (const attempt of db.attempts) {
      expect(attempt.passed).toBe(false);
    }
    for (const record of db.progress) {
      expect(record.status).not.toBe('solved');
      expect(record.solveQuality).toBeNull();
      expect(record.firstSolvedAt).toBeUndefined();
    }
  });

  it('uses the wire id encoding JSON Server needs', () => {
    expect(db.progress).toHaveLength(1);
    const record = db.progress[0];
    expect(record?.id).toBe('css-transitions__hover-lift');
    expect(record?.challengeId).toBe(DEMO_CHALLENGE_ID);
    expect(wireProgressSchema.safeParse(record).success).toBe(true);
  });
});
