import { parse } from 'acorn';
import MagicString from 'magic-string';

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

interface AstNode {
  type: string;
  start: number;
  end: number;
}

function isAstNode(value: unknown): value is AstNode & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number'
  );
}

/**
 * Structural AST walk. Deliberately not acorn-walk: its typings expose only the base node type,
 * which cannot be narrowed by `node.type` without a type assertion (banned by
 * `typescript/no-unsafe-type-assertion`). Recursing over own enumerable values visits every
 * child node and array of nodes; primitives and non-node objects (e.g. a Literal's `regex`
 * metadata, which has no start/end) are skipped by `isAstNode`.
 */
function walk(value: unknown, visit: (node: AstNode & Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isAstNode(value)) return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

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
