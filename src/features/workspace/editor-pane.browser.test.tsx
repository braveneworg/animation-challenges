import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorPane, type EditorPaneProps } from '@/features/workspace/EditorPane';
import { makeChallenge } from '@/test/challenge-fixture';

function renderPane(overrides: Partial<EditorPaneProps> = {}): {
  calls: Record<string, number>;
  props: EditorPaneProps;
} {
  const calls: Record<string, number> = { run: 0, submit: 0, reset: 0, clear: 0 };
  const challenge = makeChallenge('css-transitions/fixture');
  const props: EditorPaneProps = {
    challenge,
    files: { 'index.html': '<div class="card"></div>', 'styles.css': '.card {}' },
    activePath: 'index.html',
    onSelectFile: () => undefined,
    onFileChange: () => undefined,
    diagnostics: [],
    running: false,
    onRun: () => {
      calls.run = (calls.run ?? 0) + 1;
    },
    onSubmit: () => {
      calls.submit = (calls.submit ?? 0) + 1;
    },
    onReset: () => {
      calls.reset = (calls.reset ?? 0) + 1;
    },
    onClear: () => {
      calls.clear = (calls.clear ?? 0) + 1;
    },
    submitLabel: 'Submit',
    ...overrides,
  };
  render(<EditorPane {...props} />);
  return { calls, props };
}

describe('EditorPane', () => {
  it('renders a tab per file and the active file in the editor', async () => {
    renderPane();
    expect(screen.getByRole('tab', { name: 'index.html' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'styles.css' })).toBeTruthy();
    const editor = await screen.findByRole('textbox', { name: 'index.html' });
    expect(editor.textContent).toContain('card');
  });

  it('selecting a file tab reports the path', () => {
    let selected = '';
    renderPane({ onSelectFile: (path) => (selected = path) });
    fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }));
    expect(selected).toBe('styles.css');
  });

  it('Run and Submit fire immediately; Submit is disabled while running', () => {
    const { calls } = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(calls.run).toBe(1);
    expect(calls.submit).toBe(1);
  });

  it('disables Run and Submit while running', () => {
    renderPane({ running: true });
    const submit = screen.getByRole('button', { name: /submit|grading/i });
    expect(submit.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Run' }).hasAttribute('disabled')).toBe(true);
  });

  it('Reset requires confirmation through the dialog', async () => {
    const { calls } = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(calls.reset).toBe(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset files' }));
    await waitFor(() => expect(calls.reset).toBe(1));
  });

  it('Clear requires confirmation through the dialog', async () => {
    const { calls } = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(calls.clear).toBe(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Clear and mark unsolved' }));
    await waitFor(() => expect(calls.clear).toBe(1));
  });

  it('renders the diagnostics list for all files', () => {
    renderPane({
      diagnostics: [
        { path: 'index.html', message: 'Unexpected token', line: 1, column: 2 },
        { path: 'styles.css', message: 'Unclosed block', line: 3, column: 0 },
      ],
    });
    const list = screen.getByRole('list', { name: /problems/i });
    expect(list.textContent).toContain('index.html:1:2 Unexpected token');
    expect(list.textContent).toContain('styles.css:3:0 Unclosed block');
  });
});
