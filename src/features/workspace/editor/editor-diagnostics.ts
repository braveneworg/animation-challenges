import type { Diagnostic } from '@codemirror/lint';
import type { Text } from '@codemirror/state';

import type { TranspileDiagnostic } from '@/runner/types';

/**
 * Maps Plan 02's transpile diagnostics (sucrase: 1-based line, 0-based column, either may be null)
 * onto CodeMirror ranges. Out-of-range positions clamp — a stale diagnostic must never crash the
 * editor. The range runs to the end of the line: sucrase reports a point, not a span.
 */
export function toEditorDiagnostics(diagnostics: readonly TranspileDiagnostic[], doc: Text): Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    if (diagnostic.line === null) {
      return { from: 0, to: 0, severity: 'error' as const, message: diagnostic.message };
    }
    const lineNumber = Math.min(Math.max(diagnostic.line, 1), doc.lines);
    const line = doc.line(lineNumber);
    const column = Math.max(diagnostic.column ?? 0, 0);
    const from = Math.min(line.from + column, line.to);
    return { from, to: line.to, severity: 'error' as const, message: diagnostic.message };
  });
}
