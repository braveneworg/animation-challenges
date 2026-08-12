import { describe, expect, it } from 'vitest';

import { editorLanguageKind } from '@/features/workspace/editor/editor-language';

describe('editorLanguageKind', () => {
  it('maps stylesheet and markup extensions', () => {
    expect(editorLanguageKind('styles.css')).toBe('css');
    expect(editorLanguageKind('index.html')).toBe('html');
  });

  it('maps script extensions including JSX variants', () => {
    expect(editorLanguageKind('index.ts')).toBe('typescript');
    expect(editorLanguageKind('App.tsx')).toBe('tsx');
    expect(editorLanguageKind('legacy.js')).toBe('javascript');
    expect(editorLanguageKind('Widget.jsx')).toBe('jsx');
  });

  it('is case-insensitive and falls back to plain', () => {
    expect(editorLanguageKind('README.CSS')).toBe('css');
    expect(editorLanguageKind('notes.txt')).toBe('plain');
  });
});
