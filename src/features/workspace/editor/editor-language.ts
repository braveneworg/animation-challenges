import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import type { Extension } from '@codemirror/state';

export type EditorLanguageKind = 'css' | 'html' | 'typescript' | 'tsx' | 'javascript' | 'jsx' | 'plain';

export function editorLanguageKind(path: string): EditorLanguageKind {
  const lower = path.toLowerCase();
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.tsx')) return 'tsx';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx')) return 'jsx';
  if (lower.endsWith('.js')) return 'javascript';
  return 'plain';
}

export function languageExtension(kind: EditorLanguageKind): Extension {
  switch (kind) {
    case 'css':
      return css();
    case 'html':
      return html();
    case 'typescript':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'jsx':
      return javascript({ jsx: true });
    case 'javascript':
      return javascript();
    case 'plain':
    default:
      return [];
  }
}
