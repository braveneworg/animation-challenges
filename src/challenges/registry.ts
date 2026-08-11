import { safeParseChallenge } from '@/challenges/schema';
import type { Challenge } from '@/challenges/types';

export interface RegistryError {
  modulePath: string;
  issues: string[];
}

export interface Registry {
  challenges: readonly Challenge[];
  byId: ReadonlyMap<string, Challenge>;
  errors: readonly RegistryError[];
}

/**
 * Orders ids by code point rather than `localeCompare`, whose collation depends on the host's
 * default locale and ICU build — a Node compiled with small-icu, or a machine with a different
 * locale, can order the same catalog differently. Ids are ASCII kebab-case with a single slash,
 * so a relational comparison is fully defined for them and identical everywhere.
 */
function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** `./css-transitions/hover-lift.ts` -> `css-transitions/hover-lift` */
function idFromModulePath(modulePath: string): string {
  return modulePath.replace(/^\.\//, '').replace(/\.ts$/, '');
}

function readChallengeExport(moduleValue: unknown): unknown {
  if (typeof moduleValue !== 'object' || moduleValue === null) return undefined;
  return 'challenge' in moduleValue ? moduleValue.challenge : undefined;
}

export function buildRegistry(modules: Record<string, unknown>): Registry {
  const challenges: Challenge[] = [];
  const errors: RegistryError[] = [];
  const seenIds = new Set<string>();

  for (const modulePath of Object.keys(modules).sort()) {
    try {
      const exported = readChallengeExport(modules[modulePath]);

      if (exported === undefined) {
        errors.push({ modulePath, issues: ['module must export a `challenge` constant'] });
        continue;
      }

      const parsed = safeParseChallenge(exported);
      if (!parsed.success) {
        errors.push({ modulePath, issues: parsed.issues });
        continue;
      }

      const expectedId = idFromModulePath(modulePath);
      if (parsed.data.id !== expectedId) {
        errors.push({
          modulePath,
          issues: [`id "${parsed.data.id}" does not match its file path, which implies "${expectedId}"`],
        });
        continue;
      }

      if (seenIds.has(parsed.data.id)) {
        errors.push({
          modulePath,
          issues: [`duplicate id "${parsed.data.id}" is already provided by another module`],
        });
        continue;
      }

      seenIds.add(parsed.data.id);
      challenges.push(parsed.data);
    } catch (error) {
      // Reading the export or parsing it can run arbitrary user code (a throwing getter,
      // for instance), so this must not be allowed to abort the loop for every module
      // not yet visited — one broken challenge must not hide the other 122.
      errors.push({ modulePath, issues: [`threw while reading its \`challenge\` export: ${String(error)}`] });
    }
  }

  challenges.sort((a, b) => compareIds(a.id, b.id));

  // Ids derive from module paths, but distinct keys can still collide once normalized
  // (e.g. `./foo.ts` and `foo.ts` both derive `foo`), so uniqueness is not structural.
  // `seenIds` above is what actually guarantees `challenges.length === byId.size` by
  // rejecting a repeat instead of silently overwriting it here.
  const byId = new Map<string, Challenge>(challenges.map((entry) => [entry.id, entry]));

  return { challenges, byId, errors };
}

// Grader and test modules live beside challenge modules and must not be collected.
const challengeModules: Record<string, unknown> = import.meta.glob(['./*/*.ts', '!./*/*.grade.ts', '!./*/*.test.ts'], {
  eager: true,
});

export const challengeRegistry: Registry = buildRegistry(challengeModules);

export function getChallenge(id: string): Challenge | undefined {
  return challengeRegistry.byId.get(id);
}
