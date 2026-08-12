import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { toEditorDiagnostics } from '@/features/workspace/editor/editor-diagnostics';

const doc = Text.of(['const a = 1;', 'const b = ;', 'const c = 3;']);

describe('toEditorDiagnostics', () => {
  it('maps a 1-based line and 0-based column to a range ending at the line end', () => {
    const [diagnostic] = toEditorDiagnostics(
      [{ path: 'index.ts', message: 'Unexpected token', line: 2, column: 10 }],
      doc,
    );
    expect(diagnostic?.from).toBe(doc.line(2).from + 10);
    expect(diagnostic?.to).toBe(doc.line(2).to);
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toBe('Unexpected token');
  });

  it('anchors a null location at the document start', () => {
    const [diagnostic] = toEditorDiagnostics([{ path: 'index.ts', message: 'boom', line: null, column: null }], doc);
    expect(diagnostic?.from).toBe(0);
    expect(diagnostic?.to).toBe(0);
  });

  it('clamps out-of-range lines and columns instead of throwing', () => {
    const [beyondLine] = toEditorDiagnostics([{ path: 'x', message: 'm', line: 99, column: 0 }], doc);
    expect(beyondLine?.from).toBe(doc.line(3).from);
    const [beyondColumn] = toEditorDiagnostics([{ path: 'x', message: 'm', line: 1, column: 999 }], doc);
    expect(beyondColumn?.from).toBe(doc.line(1).to);
  });
});
