export interface AstNode {
  type: string;
  start: number;
  end: number;
}

export function isAstNode(value: unknown): value is AstNode & Record<string, unknown> {
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
export function walk(value: unknown, visit: (node: AstNode & Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isAstNode(value)) return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}
