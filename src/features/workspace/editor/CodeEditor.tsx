import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';

import { toEditorDiagnostics } from '@/features/workspace/editor/editor-diagnostics';
import { editorLanguageKind, languageExtension } from '@/features/workspace/editor/editor-language';
import { editorTheme } from '@/features/workspace/editor/editor-theme';
import type { TranspileDiagnostic } from '@/runner/types';

export interface CodeEditorProps {
  path: string;
  value: string;
  ariaLabel: string;
  onChange?: ((value: string) => void) | undefined;
  readOnly?: boolean | undefined;
  diagnostics?: readonly TranspileDiagnostic[] | undefined;
  onViewReady?: ((view: EditorView | null) => void) | undefined;
}

const EMPTY_DIAGNOSTICS: readonly TranspileDiagnostic[] = [];

/**
 * CodeMirror 6 binding. The view is created exactly once per component instance (parents remount
 * per file via `key`); path, readOnly, aria-label, external value, and diagnostics changes are
 * applied through compartments/effects. Tab deliberately moves focus (accessibility): indentation
 * comes from the EditorToolbar button and the default Mod-[ / Mod-] bindings.
 */
export function CodeEditor({
  path,
  value,
  ariaLabel,
  onChange,
  readOnly = false,
  diagnostics = EMPTY_DIAGNOSTICS,
  onViewReady,
}: CodeEditorProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef<CodeEditorProps['onChange']>(undefined);
  const onViewReadyRef = useRef<CodeEditorProps['onViewReady']>(undefined);
  const initialValueRef = useRef(value);
  const compartmentsRef = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    attributes: new Compartment(),
  });

  useEffect(() => {
    onChangeRef.current = onChange;
    onViewReadyRef.current = onViewReady;
  }, [onChange, onViewReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    const compartments = compartmentsRef.current;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          indentUnit.of('  '),
          lintGutter(),
          EditorView.lineWrapping,
          editorTheme,
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
          compartments.language.of([]),
          compartments.readOnly.of([]),
          compartments.attributes.of([]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    onViewReadyRef.current?.(view);
    return (): void => {
      onViewReadyRef.current?.(null);
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartmentsRef.current.language.reconfigure(languageExtension(editorLanguageKind(path))),
    });
  }, [path]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartmentsRef.current.readOnly.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartmentsRef.current.attributes.reconfigure(
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
      ),
    });
  }, [ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    view.dispatch(setDiagnostics(view.state, toEditorDiagnostics(diagnostics, view.state.doc)));
  }, [diagnostics]);

  return <div ref={hostRef} className="border-border h-full min-h-0 overflow-hidden rounded-md border" />;
}
