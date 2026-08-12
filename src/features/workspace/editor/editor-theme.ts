import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const chrome = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    fontSize: '0.875rem',
    height: '100%',
  },
  '.cm-content': {
    caretColor: 'var(--editor-cursor)',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  },
  '.cm-cursor': { borderLeftColor: 'var(--editor-cursor)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-muted)',
    color: 'var(--color-muted-foreground)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection)',
  },
  '&.cm-focused': { outline: '2px solid var(--color-ring)', outlineOffset: '-1px' },
});

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'var(--editor-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--editor-string)' },
  { tag: [tags.number, tags.bool, tags.atom, tags.unit], color: 'var(--editor-number)' },
  { tag: tags.comment, color: 'var(--editor-comment)', fontStyle: 'italic' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--editor-property)' },
  { tag: [tags.typeName, tags.className, tags.tagName], color: 'var(--editor-tag)' },
  { tag: tags.function(tags.variableName), color: 'var(--editor-function)' },
]);

/** Theme-variable-driven, so one extension serves light and dark (the `.dark` class swaps tokens). */
export const editorTheme: Extension = [chrome, syntaxHighlighting(highlight)];
