import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it } from 'vitest';

import { previewEnvironment } from '@/features/workspace/preview-environment';
import { usePreviewFrame } from '@/features/workspace/use-preview-frame';
import { toMountPayload } from '@/runner/protocol';
import { TranspilerClient } from '@/runner/transpiler-client';
import { makeChallenge } from '@/test/challenge-fixture';

const challenge = makeChallenge('css-transitions/preview-fixture', {
  starter: { 'index.html': '<div id="probe">probe-content</div>', 'index.ts': 'console.log("hello-preview");' },
});

function Harness(): React.JSX.Element {
  const environment = useMemo(() => previewEnvironment(false), []);
  const frame = usePreviewFrame({ environment, enabled: true });
  const mountStarter = (): void => {
    const transpiler = new TranspilerClient();
    void transpiler
      .prepare(challenge.starter, 'dom')
      .then((result) => {
        if (result.ok) frame.mount(toMountPayload(challenge, result.submission));
        return undefined;
      })
      .finally(() => transpiler.dispose())
      .catch(() => undefined);
  };
  return (
    <div>
      <p>status:{frame.status}</p>
      <button type="button" onClick={mountStarter}>
        mount
      </button>
      <ul>
        {frame.consoleLines.map((line) => (
          <li key={line.id}>{line.text}</li>
        ))}
      </ul>
      <div data-testid="frame-container" ref={frame.containerRef} />
    </div>
  );
}

describe('usePreviewFrame', () => {
  it('creates a visible frame, mounts a payload, and captures console output', async () => {
    render(<Harness />);
    await screen.findByText('status:ready', undefined, { timeout: 15_000 });
    const container = screen.getByTestId('frame-container');
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.style.position).toBe('static');
    expect(iframe?.title).toBe('Challenge preview');
    fireEvent.click(screen.getByRole('button', { name: 'mount' }));
    await waitFor(() => expect(screen.getByText('hello-preview')).toBeTruthy(), { timeout: 15_000 });
  }, 40_000);
});
