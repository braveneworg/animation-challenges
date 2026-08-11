import { prepareSubmission } from '@/runner/pipeline';
import { prepareRequestSchema, type PrepareResponse } from '@/runner/worker-protocol';

// Sucrase and acorn live here, off the main thread (spec §6.1). The request is zod-validated even
// though both ends are our code: a malformed message is a bug we want loud, not a hang. A parse
// failure is always logged; when the raw payload still carries a usable numeric `requestId` we
// also echo back a failed `PrepareResponse` so the client's pending promise settles instead of
// hanging forever. Without a usable `requestId` there is no request to correlate to, so the
// console.error is all that's possible.
addEventListener('message', (event: MessageEvent) => {
  const parsed = prepareRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    console.error('transpile worker received a malformed prepare request', parsed.error);
    const raw: unknown = event.data;
    if (typeof raw === 'object' && raw !== null && 'requestId' in raw && typeof raw.requestId === 'number') {
      const response: PrepareResponse = {
        requestId: raw.requestId,
        result: {
          ok: false,
          diagnostics: [{ path: '', message: 'malformed prepare request', line: null, column: null }],
        },
      };
      postMessage(response);
    }
    return;
  }
  const { requestId, files, runtime } = parsed.data;
  const response: PrepareResponse = { requestId, result: prepareSubmission(files, runtime) };
  postMessage(response);
});
