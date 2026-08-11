import { parseHostMessage, PROTOCOL_VERSION, type FrameMessage } from '@/runner/protocol';

function post(message: FrameMessage): void {
  window.parent.postMessage(message, window.origin);
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const message = parseHostMessage(event.data);
  if (message === null) {
    post({ v: PROTOCOL_VERSION, type: 'error', scope: 'protocol', message: 'unrecognised host message', stack: null });
  }
});

post({ v: PROTOCOL_VERSION, type: 'ready' });
