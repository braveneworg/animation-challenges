import { prepareSubmission } from '@/runner/pipeline';
import { prepareRequestSchema, type PrepareResponse } from '@/runner/worker-protocol';

// Sucrase and acorn live here, off the main thread (spec §6.1). The request is zod-validated even
// though both ends are our code: a malformed message is a bug we want loud, not a hang.
addEventListener('message', (event: MessageEvent) => {
  const parsed = prepareRequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const { requestId, files, runtime } = parsed.data;
  const response: PrepareResponse = { requestId, result: prepareSubmission(files, runtime) };
  postMessage(response);
});
