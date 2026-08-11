import type { GradeContext, GradeFunction } from '@/sandbox/grade-context';

// Graders are collected here, in the sandbox bundle, NEVER by the challenge registry (whose glob
// already excludes ./*/*.grade.ts — a deliberate Plan 01 decision). Non-eager: a grader loads only
// when its challenge is graded.
const graderModules: Record<string, () => Promise<unknown>> = import.meta.glob('../challenges/*/*.grade.ts');

/** `../challenges/css-transitions/hover-lift.grade.ts` → `css-transitions/hover-lift` */
export function graderPathToId(path: string): string {
  return path.replace('../challenges/', '').replace(/\.grade\.ts$/, '');
}

/**
 * Every challenge id with a grader on disk — the catalog suite checks this against gradeMode.
 * Slugs beginning with `_` are test fixtures (e.g. `_timeout-fixture`), loadable via `loadGrader`
 * but excluded here so catalog rules — and any future orphan-grader check — never see them.
 */
export const graderIds: readonly string[] = Object.keys(graderModules)
  .map(graderPathToId)
  .filter((id) => !(id.split('/')[1] ?? '').startsWith('_'))
  .sort();

/**
 * Loads and wraps a grader. The wrapper invokes the untyped export via Reflect.apply and awaits
 * through Promise.resolve — the narrowing-without-assertion dance `no-unsafe-type-assertion`
 * requires for calling a function read off an unknown module shape.
 */
export async function loadGrader(challengeId: string): Promise<GradeFunction | null> {
  const loader = graderModules[`../challenges/${challengeId}.grade.ts`];
  if (loader === undefined) return null;
  const moduleValue: unknown = await loader();
  const exported =
    typeof moduleValue === 'object' && moduleValue !== null && 'grade' in moduleValue ? moduleValue.grade : undefined;
  if (typeof exported !== 'function') return null;
  return async (ctx: GradeContext): Promise<void> => {
    const result: unknown = Reflect.apply(exported, undefined, [ctx]);
    await Promise.resolve(result);
  };
}
