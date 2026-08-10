import { z } from 'zod';

import { CATEGORY_IDS } from '@/challenges/categories';
import { SERIES_IDS } from '@/challenges/series';
import type { Challenge } from '@/challenges/types';

const filesSchema = z
  .record(z.string().min(1), z.string())
  .refine((files) => Object.keys(files).length > 0, { message: 'must contain at least one file' });

const rubricItemSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1).optional(),
});

const baseChallengeSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  categoryId: z.enum(CATEGORY_IDS),
  difficulty: z.enum(['novice', 'intermediate', 'advanced', 'expert']),
  tech: z.array(z.enum(['css', 'tailwind', 'ts', 'react', 'motion', 'svg', 'waapi'])).min(1),
  runtime: z.enum(['dom', 'react', 'module']),
  brief: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  starter: filesSchema,
  solution: filesSchema,
  explanation: z.string().min(1),
  gradeMode: z.enum(['auto', 'rubric', 'hybrid']),
  rubric: z.array(rubricItemSchema).min(1).optional(),
  hints: z.array(z.string().min(1)),
  series: z.strictObject({ id: z.enum(SERIES_IDS), label: z.string().min(1) }).optional(),
  relatedIds: z.array(z.string().min(1)),
  estimatedMinutes: z.number().int().positive(),
  tags: z.array(z.string().min(1)),
  graderTimeoutMs: z.number().int().positive().optional(),
});

export const challengeSchema = baseChallengeSchema
  .refine((challenge) => challenge.id.startsWith(`${challenge.categoryId}/`), {
    message: 'id must start with the categoryId, as `${categoryId}/${slug}`',
    path: ['id'],
  })
  .refine((challenge) => challenge.id.split('/').length === 2, {
    message: 'id must contain exactly one slash',
    path: ['id'],
  })
  .refine((challenge) => challenge.gradeMode === 'auto' || (challenge.rubric?.length ?? 0) > 0, {
    message: 'a rubric is required when gradeMode is "rubric" or "hybrid"',
    path: ['rubric'],
  });

export type ParseChallengeResult = { success: true; data: Challenge } | { success: false; issues: string[] };

export function safeParseChallenge(input: unknown): ParseChallengeResult {
  const result = challengeSchema.safeParse(input);
  if (result.success) {
    // No cast: Zod's mutable output arrays are assignable to Challenge's readonly ones,
    // and `.optional()` produces exactly the `?: T | undefined` shape the interface declares.
    // If this line fails to compile, the schema and the interface have genuinely diverged —
    // fix whichever is wrong rather than casting the mismatch away.
    return { success: true, data: result.data };
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
  };
}

export function parseChallenge(input: unknown): Challenge {
  const result = safeParseChallenge(input);
  if (!result.success) {
    throw new Error(`Invalid challenge:\n  ${result.issues.join('\n  ')}`);
  }
  return result.data;
}
