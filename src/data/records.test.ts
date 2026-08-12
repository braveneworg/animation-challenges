import { describe, expect, it } from 'vitest';

import {
  safeParseAttempt,
  safeParseNote,
  safeParseProfile,
  safeParseProgressRecord,
  safeParseSettingsRecord,
  SETTINGS_DEFAULTS,
  type Attempt,
  type Note,
  type ParseResult,
  type Profile,
  type ProgressRecord,
  type SettingsRecord,
} from '@/data/records';

function assertFailure<T>(result: ParseResult<T>): asserts result is { success: false; issues: string[] } {
  if (result.success) throw new Error('expected the parse to fail');
}

function assertSuccess<T>(result: ParseResult<T>): asserts result is { success: true; data: T } {
  if (!result.success) throw new Error(`expected the parse to succeed, got: ${result.issues.join('; ')}`);
}

const validProgress: ProgressRecord = {
  id: 'css-transitions/hover-lift',
  challengeId: 'css-transitions/hover-lift',
  status: 'solved',
  solveQuality: 'clean',
  attempts: 3,
  hintsRevealed: 1,
  firstSolvedAt: '2026-08-01T10:00:00.000Z',
  lastAttemptAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

const validAttempt: Attempt = {
  id: 'a2c4e6a8-0000-4000-8000-000000000001',
  challengeId: 'css-transitions/hover-lift',
  createdAt: '2026-08-01T09:00:00.000Z',
  passed: false,
  failures: [{ message: 'The card does not rise on hover', hint: 'Which transform moves an element vertically?' }],
  durationMs: 61_000,
};

const validNote: Note = {
  id: 'css-transitions/hover-lift',
  challengeId: 'css-transitions/hover-lift',
  body: 'transition on the base selector, not on :hover',
  updatedAt: '2026-08-01T09:30:00.000Z',
};

const validProfile: Profile = { id: 'local', displayName: 'Local user', createdAt: '2026-07-01T00:00:00.000Z' };

describe('progressRecordSchema', () => {
  it('accepts a valid record', () => {
    const result = safeParseProgressRecord(validProgress);
    assertSuccess(result);
    expect(result.data).toEqual(validProgress);
  });

  it('rejects id !== challengeId', () => {
    const result = safeParseProgressRecord({ ...validProgress, id: 'css-transitions/other' });
    assertFailure(result);
    expect(result.issues.join(' ')).toContain('id must equal challengeId');
  });

  it('rejects unknown keys (strict)', () => {
    const result = safeParseProgressRecord({ ...validProgress, extra: true });
    assertFailure(result);
  });

  it('rejects a non-ISO updatedAt', () => {
    const result = safeParseProgressRecord({ ...validProgress, updatedAt: 'yesterday' });
    assertFailure(result);
  });

  it('rejects negative attempts', () => {
    const result = safeParseProgressRecord({ ...validProgress, attempts: -1 });
    assertFailure(result);
  });

  it('accepts solveQuality null and omitted optional timestamps', () => {
    const result = safeParseProgressRecord({
      id: 'css-transitions/hover-lift',
      challengeId: 'css-transitions/hover-lift',
      status: 'unsolved',
      solveQuality: null,
      attempts: 0,
      hintsRevealed: 0,
      updatedAt: '2026-08-01T10:00:00.000Z',
    });
    assertSuccess(result);
    expect(result.data.firstSolvedAt).toBeUndefined();
  });
});

describe('attemptSchema', () => {
  it('accepts a valid attempt', () => {
    const result = safeParseAttempt(validAttempt);
    assertSuccess(result);
    expect(result.data).toEqual(validAttempt);
  });

  it('rejects a failure summary without a message', () => {
    const result = safeParseAttempt({ ...validAttempt, failures: [{ hint: 'no message' }] });
    assertFailure(result);
  });
});

describe('noteSchema', () => {
  it('rejects id !== challengeId', () => {
    const result = safeParseNote({ ...validNote, id: 'other/id' });
    assertFailure(result);
  });

  it('accepts a valid note', () => {
    assertSuccess(safeParseNote(validNote));
  });
});

describe('profileSchema', () => {
  it('accepts a valid profile and rejects an empty displayName', () => {
    assertSuccess(safeParseProfile(validProfile));
    assertFailure(safeParseProfile({ ...validProfile, displayName: '' }));
  });
});

describe('settingsRecordSchema', () => {
  it('accepts the defaults', () => {
    const result = safeParseSettingsRecord(SETTINGS_DEFAULTS);
    assertSuccess(result);
    expect(result.data).toEqual(SETTINGS_DEFAULTS);
  });

  it('encodes the documented grader timeout default of 5000ms', () => {
    expect(SETTINGS_DEFAULTS.graderTimeoutMs).toBe(5000);
  });

  it('rejects a grader timeout below 1000 or above 30000', () => {
    assertFailure(safeParseSettingsRecord({ ...SETTINGS_DEFAULTS, graderTimeoutMs: 999 }));
    assertFailure(safeParseSettingsRecord({ ...SETTINGS_DEFAULTS, graderTimeoutMs: 30_001 }));
  });

  it('accepts an empty apiBaseUrl (mirror disabled) and rejects a non-URL', () => {
    assertSuccess(safeParseSettingsRecord({ ...SETTINGS_DEFAULTS, apiBaseUrl: '' }));
    assertFailure(safeParseSettingsRecord({ ...SETTINGS_DEFAULTS, apiBaseUrl: 'not a url' }));
  });

  const validSettings: SettingsRecord = {
    theme: 'dark',
    reducedMotionPreview: true,
    graderTimeoutMs: 1000,
    apiBaseUrl: '',
  };

  it('accepts every theme value', () => {
    assertSuccess(safeParseSettingsRecord(validSettings));
    assertSuccess(safeParseSettingsRecord({ ...validSettings, theme: 'light' }));
    assertSuccess(safeParseSettingsRecord({ ...validSettings, theme: 'system' }));
  });
});
