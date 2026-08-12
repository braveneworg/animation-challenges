import { faker } from '@faker-js/faker';

import type { Attempt, Note, Profile, ProgressRecord } from '../src/data/records.ts';

export interface SeedOptions {
  demo: boolean;
  seed: number;
}

export interface SeedDatabase {
  progress: ProgressRecord[];
  attempts: Attempt[];
  notes: Note[];
  profile: Profile;
}

export const DEMO_CHALLENGE_ID = 'css-transitions/hover-lift';

/** Must mirror toResourceId in src/data/http-repository.ts (value imports from src/ would break plain-node execution). */
function toServerResourceId(challengeId: string): string {
  return challengeId.replace('/', '__');
}

/**
 * Spec §7.5: the default database is a demo profile plus EMPTY progress — fake solves
 * would corrupt the one thing the app exists to measure. Demo mode adds sample attempt
 * history for empty-state and dashboard design work: failures only, never a solve.
 */
export function buildSeedDatabase(options: SeedOptions): SeedDatabase {
  faker.seed(options.seed);
  const profile: Profile = {
    id: 'local',
    displayName: faker.internet.displayName(),
    createdAt: faker.date.between({ from: '2026-01-01T00:00:00.000Z', to: '2026-06-30T00:00:00.000Z' }).toISOString(),
  };
  if (!options.demo) {
    return { progress: [], attempts: [], notes: [], profile };
  }

  const attempts: Attempt[] = Array.from({ length: 4 }, () => ({
    id: faker.string.uuid(),
    challengeId: DEMO_CHALLENGE_ID,
    createdAt: faker.date.between({ from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T00:00:00.000Z' }).toISOString(),
    passed: false,
    failures: [
      {
        message: 'The card does not rise on hover',
        hint: 'Which transform moves an element vertically?',
        actual: 'translateY(0px)',
        expected: 'translateY(-4px)',
      },
    ],
    durationMs: faker.number.int({ min: 20_000, max: 300_000 }),
  }));
  attempts.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const lastAttemptAt = attempts.at(-1)?.createdAt ?? profile.createdAt;

  const progress: ProgressRecord[] = [
    {
      id: toServerResourceId(DEMO_CHALLENGE_ID),
      challengeId: DEMO_CHALLENGE_ID,
      status: 'attempted',
      solveQuality: null,
      attempts: attempts.length,
      hintsRevealed: 1,
      lastAttemptAt,
      updatedAt: lastAttemptAt,
    },
  ];

  return { progress, attempts, notes: [], profile };
}
