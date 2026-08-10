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

  for (const modulePath of Object.keys(modules).sort()) {
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

    challenges.push(parsed.data);
  }

  challenges.sort((a, b) => a.id.localeCompare(b.id));

  // Ids are derived from module paths, and a module map cannot hold the same path twice,
  // so duplicate ids are structurally impossible here. No duplicate check is needed.
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
