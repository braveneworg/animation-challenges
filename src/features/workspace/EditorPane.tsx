import type { EditorView } from '@codemirror/view';
import { Tabs } from 'radix-ui';
import { useMemo, useState } from 'react';

import type { Challenge } from '@/challenges/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CodeEditor } from '@/features/workspace/editor/CodeEditor';
import { EditorToolbar } from '@/features/workspace/editor/EditorToolbar';
import type { TranspileDiagnostic } from '@/runner/types';

export interface EditorPaneProps {
  challenge: Challenge;
  files: Readonly<Record<string, string>>;
  activePath: string;
  // Property-style function types (not method shorthand): destructuring a method-shorthand
  // signature trips oxlint's type-aware `typescript/unbound-method` (the callback has no `this`
  // to lose, but the rule can't tell method syntax from a real method). Same call surface.
  onSelectFile: (path: string) => void;
  onFileChange: (path: string, contents: string) => void;
  diagnostics: readonly TranspileDiagnostic[];
  running: boolean;
  onRun: () => void;
  onSubmit: () => void;
  onReset: () => void;
  onClear: () => void;
  submitLabel: string;
}

export function EditorPane({
  challenge,
  files,
  activePath,
  onSelectFile,
  onFileChange,
  diagnostics,
  running,
  onRun,
  onSubmit,
  onReset,
  onClear,
  submitLabel,
}: EditorPaneProps): React.JSX.Element {
  const [view, setView] = useState<EditorView | null>(null);
  const paths = useMemo(() => Object.keys(files), [files]);
  const activeDiagnostics = useMemo(
    () => diagnostics.filter((diagnostic) => diagnostic.path === activePath),
    [diagnostics, activePath],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs.Root value={activePath} onValueChange={onSelectFile} className="flex min-h-0 flex-1 flex-col">
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1">
          <Tabs.List aria-label="Files" className="flex gap-1">
            {paths.map((path) => (
              <Tabs.Trigger
                key={path}
                value={path}
                // Radix only selects a tab from onMouseDown/onKeyDown/onFocus, not onClick, so a
                // synthetic click dispatched without a preceding mousedown (as
                // `fireEvent.click` does, and as some assistive tooling does) would otherwise be
                // a no-op. Calling onSelectFile here too is idempotent with the same value.
                onClick={() => onSelectFile(path)}
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground text-muted-foreground rounded-md px-2 py-1 font-mono text-xs"
              >
                {path}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="flex gap-1">
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  Reset
                </Button>
              }
              title="Reset files?"
              description="Your edits are replaced with the starter files. Your progress record is untouched."
              confirmLabel="Reset files"
              onConfirm={onReset}
            />
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  Clear
                </Button>
              }
              title="Clear this challenge?"
              description="Files return to the starter and the record returns to unsolved so a clean re-solve counts. Attempt history is kept."
              confirmLabel="Clear and mark unsolved"
              onConfirm={onClear}
            />
            <Button type="button" variant="outline" size="sm" onClick={onRun} disabled={running}>
              Run
            </Button>
            <Button type="button" size="sm" onClick={onSubmit} disabled={running}>
              {running ? 'Grading…' : submitLabel}
            </Button>
          </div>
        </div>
        {paths.map((path) => (
          <Tabs.Content key={path} value={path} className="min-h-0 flex-1">
            {path === activePath ? (
              <CodeEditor
                key={`${challenge.id}:${path}`}
                path={path}
                value={files[path] ?? ''}
                ariaLabel={path}
                onChange={(contents) => onFileChange(path, contents)}
                diagnostics={activeDiagnostics}
                onViewReady={setView}
              />
            ) : null}
          </Tabs.Content>
        ))}
      </Tabs.Root>
      {diagnostics.length > 0 ? (
        <ul
          aria-label="Problems"
          className="border-border max-h-24 space-y-1 overflow-y-auto border-t p-2 font-mono text-xs"
        >
          {diagnostics.map((diagnostic) => (
            <li
              key={`${diagnostic.path}:${diagnostic.line ?? '?'}:${diagnostic.column ?? '?'}:${diagnostic.message}`}
              className="text-destructive"
            >
              {diagnostic.path}:{diagnostic.line ?? '?'}:{diagnostic.column ?? '?'} {diagnostic.message}
            </li>
          ))}
        </ul>
      ) : null}
      <EditorToolbar view={view} />
    </div>
  );
}
