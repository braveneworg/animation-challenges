/** One transpile/prepare failure, precise enough for a CodeMirror inline diagnostic (spec §6.7). */
export interface TranspileDiagnostic {
  path: string;
  message: string;
  line: number | null;
  column: number | null;
}

/** A non-module file shipped to the frame verbatim (css, html). */
export interface SandboxFile {
  path: string;
  source: string;
}

/** One import/export specifier occurrence; start/end span the string literal INCLUDING its quotes. */
export interface ImportRecord {
  specifier: string;
  start: number;
  end: number;
}

/** A transpiled, loop-guarded script module plus its scanned import spans. */
export interface PreparedModule {
  path: string;
  code: string;
  imports: readonly ImportRecord[];
}

/** Everything the frame needs to mount one submission. */
export interface PreparedSubmission {
  modules: readonly PreparedModule[];
  cssFiles: readonly SandboxFile[];
  htmlFile: SandboxFile | null;
  entryPath: string | null;
  sources: Readonly<Record<string, string>>;
}

export type PrepareResult =
  { ok: true; submission: PreparedSubmission } | { ok: false; diagnostics: readonly TranspileDiagnostic[] };

/** What a grader passes to `ctx.expect`. `hint` is mandatory: the failure message is teaching material (spec §6.5). */
export interface AssertionDetail {
  message: string;
  hint: string;
  actual?: unknown;
  expected?: unknown;
}

/** A recorded assertion outcome; `actual`/`expected` are pre-stringified so the record is postMessage-safe. */
export interface AssertionRecord {
  ok: boolean;
  message: string;
  hint: string;
  actual: string | null;
  expected: string | null;
}

/** The frame's complete answer to a `grade` request (spec §6.3 `graded`). */
export interface GradeRunReport {
  challengeId: string;
  passed: boolean;
  assertions: readonly AssertionRecord[];
  threw: { message: string; stack: string | null } | null;
  timedOut: boolean;
  durationMs: number;
}
