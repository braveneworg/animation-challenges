import { z } from 'zod';

import type { Challenge, RuntimeKind } from '@/challenges/types';
import type {
  AssertionRecord,
  GradeRunReport,
  ImportRecord,
  PreparedModule,
  PreparedSubmission,
  SandboxFile,
  TranspileDiagnostic,
} from '@/runner/types';

/** Bump when a message shape changes incompatibly; both sides reject other versions (spec §6.3). */
export const PROTOCOL_VERSION = 1;

export interface SandboxEnvironment {
  /** null = do not patch; the frame sees the real OS preference. */
  forcedReducedMotion: boolean | null;
  clock: 'virtual' | 'real';
  viewport: { width: number; height: number };
}

export const DEFAULT_ENVIRONMENT: SandboxEnvironment = {
  forcedReducedMotion: null,
  clock: 'virtual',
  viewport: { width: 800, height: 600 },
};

const importRecordSchema: z.ZodType<ImportRecord> = z.object({
  specifier: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const sandboxFileSchema: z.ZodType<SandboxFile> = z.object({ path: z.string(), source: z.string() });

export const preparedModuleSchema: z.ZodType<PreparedModule> = z.object({
  path: z.string(),
  code: z.string(),
  imports: z.array(importRecordSchema),
});

export const transpileDiagnosticSchema: z.ZodType<TranspileDiagnostic> = z.object({
  path: z.string(),
  message: z.string(),
  line: z.number().int().nullable(),
  column: z.number().int().nullable(),
});

const environmentSchema: z.ZodType<SandboxEnvironment> = z.object({
  forcedReducedMotion: z.boolean().nullable(),
  clock: z.enum(['virtual', 'real']),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
});

export interface MountPayload {
  challengeId: string;
  runtime: RuntimeKind;
  wantsTailwind: boolean;
  modules: readonly PreparedModule[];
  cssFiles: readonly SandboxFile[];
  htmlFile: SandboxFile | null;
  entryPath: string | null;
  sources: Readonly<Record<string, string>>;
}

const mountPayloadSchema: z.ZodType<MountPayload> = z.object({
  challengeId: z.string(),
  runtime: z.enum(['dom', 'react', 'module']),
  wantsTailwind: z.boolean(),
  modules: z.array(preparedModuleSchema),
  cssFiles: z.array(sandboxFileSchema),
  htmlFile: sandboxFileSchema.nullable(),
  entryPath: z.string().nullable(),
  sources: z.record(z.string(), z.string()),
});

const hostMessageSchema = z.discriminatedUnion('type', [
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('setEnvironment'), environment: environmentSchema }),
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('mount'), mount: mountPayloadSchema }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('grade'),
    challengeId: z.string(),
    timeoutMs: z.number().int().positive(),
  }),
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('reset') }),
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('replay') }),
]);

export type HostMessage = z.infer<typeof hostMessageSchema>;

const assertionRecordSchema: z.ZodType<AssertionRecord> = z.object({
  ok: z.boolean(),
  message: z.string(),
  hint: z.string(),
  actual: z.string().nullable(),
  expected: z.string().nullable(),
});

const gradeRunReportSchema: z.ZodType<GradeRunReport> = z.object({
  challengeId: z.string(),
  passed: z.boolean(),
  assertions: z.array(assertionRecordSchema),
  threw: z.object({ message: z.string(), stack: z.string().nullable() }).nullable(),
  timedOut: z.boolean(),
  durationMs: z.number().nonnegative(),
});

const frameMessageSchema = z.discriminatedUnion('type', [
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('ready') }),
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('mounted'), challengeId: z.string() }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('console'),
    level: z.enum(['log', 'info', 'warn', 'error']),
    text: z.string(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('error'),
    scope: z.enum(['mount', 'grade', 'protocol']),
    message: z.string(),
    stack: z.string().nullable(),
  }),
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal('graded'), report: gradeRunReportSchema }),
]);

export type FrameMessage = z.infer<typeof frameMessageSchema>;

export function parseHostMessage(data: unknown): HostMessage | null {
  const result = hostMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseFrameMessage(data: unknown): FrameMessage | null {
  const result = frameMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** Host-side mapping from a challenge + prepared submission to the frame's mount payload. */
export function toMountPayload(challenge: Challenge, submission: PreparedSubmission): MountPayload {
  return {
    challengeId: challenge.id,
    runtime: challenge.runtime,
    wantsTailwind: challenge.tech.includes('tailwind'),
    modules: submission.modules,
    cssFiles: submission.cssFiles,
    htmlFile: submission.htmlFile,
    entryPath: submission.entryPath,
    sources: submission.sources,
  };
}
