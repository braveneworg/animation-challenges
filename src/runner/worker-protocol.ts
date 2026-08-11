import { z } from 'zod';

import type { RuntimeKind } from '@/challenges/types';
import { preparedModuleSchema, sandboxFileSchema, transpileDiagnosticSchema } from '@/runner/protocol';
import type { PreparedSubmission, PrepareResult } from '@/runner/types';

const preparedSubmissionSchema: z.ZodType<PreparedSubmission> = z.object({
  modules: z.array(preparedModuleSchema),
  cssFiles: z.array(sandboxFileSchema),
  htmlFile: sandboxFileSchema.nullable(),
  entryPath: z.string().nullable(),
  sources: z.record(z.string(), z.string()),
});

const prepareResultSchema: z.ZodType<PrepareResult> = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), submission: preparedSubmissionSchema }),
  z.object({ ok: z.literal(false), diagnostics: z.array(transpileDiagnosticSchema) }),
]);

export interface PrepareRequest {
  requestId: number;
  files: Readonly<Record<string, string>>;
  runtime: RuntimeKind;
}

export interface PrepareResponse {
  requestId: number;
  result: PrepareResult;
}

export const prepareRequestSchema: z.ZodType<PrepareRequest> = z.object({
  requestId: z.number().int().positive(),
  files: z.record(z.string(), z.string()),
  runtime: z.enum(['dom', 'react', 'module']),
});

export const prepareResponseSchema: z.ZodType<PrepareResponse> = z.object({
  requestId: z.number().int().positive(),
  result: prepareResultSchema,
});
