import { parse } from 'acorn';
import MagicString from 'magic-string';

import { isAstNode, walk } from '@/runner/ast';

/** The free identifier guarded code calls; the sandbox harness installs it globally before user code runs. */
export const LOOP_GUARD_FN = '__acLoopGuard';

export interface LoopGuardInjection {
  code: string;
  loopCount: number;
}

const LOOP_TYPES: ReadonlySet<string> = new Set([
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
]);

/**
 * Injects a guard call into every loop body of `code` (spec §6.6): `while`, `do…while`, `for`,
 * `for…of`, `for…in`. Block bodies get the call inserted after `{`; single-statement bodies are
 * wrapped in a block so constructs like `else while (c) x();` stay syntactically valid.
 * `code` must be the TRANSPILED output (plain JS) — acorn does not parse TypeScript.
 */
export function injectLoopGuards(code: string, firstLoopId: number): LoopGuardInjection {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const ms = new MagicString(code);
  let nextId = firstLoopId;

  walk(ast, (node) => {
    if (!LOOP_TYPES.has(node.type)) return;
    const body: unknown = node.body;
    if (!isAstNode(body)) return;
    const id = nextId;
    nextId += 1;
    if (body.type === 'BlockStatement') {
      ms.appendLeft(body.start + 1, `${LOOP_GUARD_FN}(${id});`);
    } else {
      ms.appendLeft(body.start, `{${LOOP_GUARD_FN}(${id});`);
      ms.appendRight(body.end, '}');
    }
  });

  const loopCount = nextId - firstLoopId;
  return { code: loopCount === 0 ? code : ms.toString(), loopCount };
}
