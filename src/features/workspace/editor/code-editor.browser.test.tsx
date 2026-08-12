import type { EditorView } from '@codemirror/view';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { CodeEditor } from '@/features/workspace/editor/CodeEditor';
import { EditorToolbar, insertSymbol } from '@/features/workspace/editor/EditorToolbar';

// `get`/`set` are declared as function-typed properties rather than method shorthand: method
// signature syntax carries an implicit polymorphic `this`, which is what `typescript/unbound-method`
// flags at every call site below that passes `holder.set` by reference (e.g. `onViewReady={holder.set}`)
// instead of invoking it (same pattern as `SyncTriggerOptions` in src/app/sync-triggers.ts).
function captureView(): { get: () => EditorView; set: (view: EditorView | null) => void } {
  let current: EditorView | null = null;
  return {
    get: () => {
      if (current === null) throw new Error('editor view not ready');
      return current;
    },
    set: (view) => {
      current = view;
    },
  };
}

describe('CodeEditor', () => {
  it('renders the document and exposes an accessible textbox', async () => {
    const holder = captureView();
    render(
      <CodeEditor path="styles.css" value=".card { color: red; }" ariaLabel="styles.css" onViewReady={holder.set} />,
    );
    const textbox = await screen.findByRole('textbox', { name: 'styles.css' });
    expect(textbox.textContent).toContain('.card');
  });

  it('reports edits through onChange with the full document', async () => {
    const holder = captureView();
    const changes: string[] = [];
    render(
      <CodeEditor
        path="index.ts"
        value="const a = 1;"
        ariaLabel="index.ts"
        onChange={(value) => changes.push(value)}
        onViewReady={holder.set}
      />,
    );
    await screen.findByRole('textbox', { name: 'index.ts' });
    const view = holder.get();
    view.dispatch({ changes: { from: view.state.doc.length, insert: '\nconst b = 2;' } });
    await waitFor(() => expect(changes.at(-1)).toBe('const a = 1;\nconst b = 2;'));
  });

  it('applies external value changes by replacing the document', async () => {
    const holder = captureView();
    function Harness(): React.JSX.Element {
      const [value, setValue] = useState('original');
      return (
        <div>
          <button type="button" onClick={() => setValue('replaced')}>
            swap
          </button>
          <CodeEditor path="index.ts" value={value} ariaLabel="index.ts" onViewReady={holder.set} />
        </div>
      );
    }
    render(<Harness />);
    await screen.findByRole('textbox', { name: 'index.ts' });
    fireEvent.click(screen.getByRole('button', { name: 'swap' }));
    await waitFor(() => expect(holder.get().state.doc.toString()).toBe('replaced'));
  });

  it('renders read-only mode without an editable content element', async () => {
    const holder = captureView();
    render(<CodeEditor path="index.ts" value="const a = 1;" ariaLabel="solution" readOnly onViewReady={holder.set} />);
    await screen.findByRole('textbox', { name: 'solution' });
    expect(holder.get().contentDOM.getAttribute('contenteditable')).toBe('false');
  });

  it('marks transpile diagnostics in the document', async () => {
    const holder = captureView();
    const { container } = render(
      <CodeEditor
        path="index.ts"
        value={'const a = 1;\nconst b = ;'}
        ariaLabel="index.ts"
        diagnostics={[{ path: 'index.ts', message: 'Unexpected token', line: 2, column: 10 }]}
        onViewReady={holder.set}
      />,
    );
    await screen.findByRole('textbox', { name: 'index.ts' });
    await waitFor(() => expect(container.querySelector('.cm-lintRange-error')).toBeTruthy());
  });
});

describe('EditorToolbar', () => {
  it('inserts the pressed symbol at the cursor and keeps focus in the editor', async () => {
    const holder = captureView();
    function Harness(): React.JSX.Element {
      const [view, setView] = useState<EditorView | null>(null);
      return (
        <div>
          <CodeEditor
            path="index.ts"
            value=""
            ariaLabel="index.ts"
            onViewReady={(next) => {
              holder.set(next);
              setView(next);
            }}
          />
          <EditorToolbar view={view} />
        </div>
      );
    }
    render(<Harness />);
    await screen.findByRole('textbox', { name: 'index.ts' });
    const toolbar = screen.getByRole('toolbar', { name: /editor symbols/i });
    expect(toolbar).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Insert =>' }));
    await waitFor(() => expect(holder.get().state.doc.toString()).toBe('=>'));
    expect(holder.get().hasFocus).toBe(true);
  });

  it('insertSymbol replaces the current selection', async () => {
    const holder = captureView();
    render(<CodeEditor path="index.ts" value="abc" ariaLabel="index.ts" onViewReady={holder.set} />);
    await screen.findByRole('textbox', { name: 'index.ts' });
    const view = holder.get();
    view.dispatch({ selection: { anchor: 0, head: 3 } });
    insertSymbol(view, '{');
    expect(view.state.doc.toString()).toBe('{');
  });
});
