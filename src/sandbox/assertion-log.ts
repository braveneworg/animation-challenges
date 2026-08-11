import { safeString } from '@/runner/safe-string';
import type { AssertionDetail, AssertionRecord } from '@/runner/types';

/**
 * Accumulating assertion recorder (spec §6.5): assertions never short-circuit, so a grader runs to
 * completion and the user sees every failing criterion at once. `record` returns `ok` so graders
 * can branch on it for derived assertions without re-testing.
 */
export class AssertionLog {
  #records: AssertionRecord[] = [];

  record(ok: boolean, detail: AssertionDetail): boolean {
    this.#records.push({
      ok,
      message: detail.message,
      hint: detail.hint,
      actual: detail.actual === undefined ? null : safeString(detail.actual),
      expected: detail.expected === undefined ? null : safeString(detail.expected),
    });
    return ok;
  }

  get records(): readonly AssertionRecord[] {
    return this.#records;
  }

  get allPassed(): boolean {
    return this.#records.every((record) => record.ok);
  }
}
