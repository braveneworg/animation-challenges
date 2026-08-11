import { afterEach, expect, test } from 'vitest';

import { parseFrameMessage } from '@/runner/protocol';

let iframe: HTMLIFrameElement | null = null;
const revoke: string[] = [];

afterEach(() => {
  iframe?.remove();
  iframe = null;
  for (const url of revoke.splice(0)) URL.revokeObjectURL(url);
});

function createSandboxFrame(): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    const timer = setTimeout(() => reject(new Error('sandbox never posted ready')), 10_000);
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== el.contentWindow) return;
      const message = parseFrameMessage(event.data);
      if (message?.type === 'ready') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(el);
      }
    };
    window.addEventListener('message', onMessage);
    document.body.append(el);
    el.src = '/sandbox.html';
  });
}

test('sandbox.html loads same-origin and posts ready', async () => {
  iframe = await createSandboxFrame();
  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) throw new Error('frame document unreachable — sandbox is not same-origin');
  expect(frameDoc.getElementById('stage')).not.toBeNull();
});

test('a blob module resolves bare specifiers through the frame import map (spec §6.2 regression)', async () => {
  iframe = await createSandboxFrame();
  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) throw new Error('frame document unreachable');
  const probe = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('probe module never reported')), 10_000);
    const onMessage = (event: MessageEvent): void => {
      const data: unknown = event.data;
      if (typeof data === 'object' && data !== null && 'probe' in data && typeof data.probe === 'string') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data.probe);
      }
    };
    window.addEventListener('message', onMessage);
  });
  const code = "import { version } from 'react';\nwindow.parent.postMessage({ probe: version }, '*');\n";
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  revoke.push(url);
  const script = frameDoc.createElement('script');
  script.type = 'module';
  script.src = url;
  frameDoc.body.append(script);
  const version = await probe;
  expect(version).toMatch(/^19\./);
});
