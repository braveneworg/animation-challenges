import { z } from 'zod';

import { DEFAULT_GRADER_TIMEOUT_MS } from '@/challenges/types';

export type ProgressStatus = 'unsolved' | 'attempted' | 'solved';
export type SolveQuality = 'clean' | 'assisted';
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * The persisted failure shape stored on an Attempt. Plan 05 maps the runner's live grade
 * results into this serializable form (actual/expected pre-serialized to strings).
 */
export interface FailureSummary {
  message: string;
  hint?: string | undefined;
  actual?: string | undefined;
  expected?: string | undefined;
}

export interface ProgressRecord {
  /** Always === challengeId; a separate field only because JSON Server keys resources by `id`. */
  id: string;
  challengeId: string;
  status: ProgressStatus;
  /** 'assisted' iff the solution was viewed before the first passing submit. Never gates anything. */
  solveQuality: SolveQuality | null;
  attempts: number;
  hintsRevealed: number;
  firstSolvedAt?: string | undefined;
  lastAttemptAt?: string | undefined;
  viewedSolutionAt?: string | undefined;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  challengeId: string;
  createdAt: string;
  passed: boolean;
  failures: FailureSummary[];
  durationMs: number;
}

export interface Note {
  /** Always === challengeId: one note per challenge. */
  id: string;
  challengeId: string;
  body: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  displayName: string;
  createdAt: string;
}

/** Local-only (its apiBaseUrl configures the mirror). '' disables the HTTP mirror. */
export interface SettingsRecord {
  theme: ThemePreference;
  reducedMotionPreview: boolean;
  graderTimeoutMs: number;
  apiBaseUrl: string;
}

export const GRADER_TIMEOUT_MS_MIN = 1000;
export const GRADER_TIMEOUT_MS_MAX = 30_000;
export const DEFAULT_API_BASE_URL = 'http://localhost:3001';

export const SETTINGS_DEFAULTS: SettingsRecord = {
  theme: 'system',
  reducedMotionPreview: false,
  // Spec §6.7's 5000ms default lives in ONE place: Plan 02's DEFAULT_GRADER_TIMEOUT_MS.
  graderTimeoutMs: DEFAULT_GRADER_TIMEOUT_MS,
  apiBaseUrl: DEFAULT_API_BASE_URL,
};

const isoDateTime = z.iso.datetime();

export const failureSummarySchema = z.strictObject({
  message: z.string().min(1),
  hint: z.string().optional(),
  actual: z.string().optional(),
  expected: z.string().optional(),
});

/** Raw shape, exported so the HTTP layer can build a wire schema without the id refine. */
export const progressRecordShape = {
  id: z.string().min(1),
  challengeId: z.string().min(1),
  status: z.enum(['unsolved', 'attempted', 'solved']),
  solveQuality: z.enum(['clean', 'assisted']).nullable(),
  attempts: z.number().int().nonnegative(),
  hintsRevealed: z.number().int().nonnegative(),
  firstSolvedAt: isoDateTime.optional(),
  lastAttemptAt: isoDateTime.optional(),
  viewedSolutionAt: isoDateTime.optional(),
  updatedAt: isoDateTime,
};

export const progressRecordSchema = z
  .strictObject(progressRecordShape)
  .refine((record) => record.id === record.challengeId, {
    message: 'id must equal challengeId',
    path: ['id'],
  });

export const attemptSchema = z.strictObject({
  id: z.string().min(1),
  challengeId: z.string().min(1),
  createdAt: isoDateTime,
  passed: z.boolean(),
  failures: z.array(failureSummarySchema),
  durationMs: z.number().nonnegative(),
});

/** Raw shape, exported for the HTTP layer's wire schema (same reason as progressRecordShape). */
export const noteShape = {
  id: z.string().min(1),
  challengeId: z.string().min(1),
  body: z.string(),
  updatedAt: isoDateTime,
};

export const noteSchema = z.strictObject(noteShape).refine((note) => note.id === note.challengeId, {
  message: 'id must equal challengeId',
  path: ['id'],
});

export const profileSchema = z.strictObject({
  id: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: isoDateTime,
});

export const settingsRecordSchema = z.strictObject({
  theme: z.enum(['system', 'light', 'dark']),
  reducedMotionPreview: z.boolean(),
  graderTimeoutMs: z.number().int().min(GRADER_TIMEOUT_MS_MIN).max(GRADER_TIMEOUT_MS_MAX),
  apiBaseUrl: z.union([z.literal(''), z.url()]),
});

export type ParseResult<T> = { success: true; data: T } | { success: false; issues: string[] };

export function parseWith<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
  };
}

export function safeParseProgressRecord(input: unknown): ParseResult<ProgressRecord> {
  return parseWith<ProgressRecord>(progressRecordSchema, input);
}

export function safeParseAttempt(input: unknown): ParseResult<Attempt> {
  return parseWith<Attempt>(attemptSchema, input);
}

export function safeParseNote(input: unknown): ParseResult<Note> {
  return parseWith<Note>(noteSchema, input);
}

export function safeParseProfile(input: unknown): ParseResult<Profile> {
  return parseWith<Profile>(profileSchema, input);
}

export function safeParseSettingsRecord(input: unknown): ParseResult<SettingsRecord> {
  return parseWith<SettingsRecord>(settingsRecordSchema, input);
}
