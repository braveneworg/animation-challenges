import type { Challenge } from '@/challenges/types';

/** Minimal valid Challenge for unit tests. Override any field; the id is always explicit. */
export function makeChallenge(id: string, overrides: Partial<Challenge> = {}): Challenge {
  const base: Challenge = {
    id,
    title: 'Fixture challenge',
    categoryId: 'css-transitions',
    difficulty: 'novice',
    tech: ['css'],
    runtime: 'dom',
    brief: 'Fixture brief',
    goals: ['Fixture goal'],
    starter: { 'index.html': '<div class="card"></div>', 'styles.css': '.card {}' },
    solution: { 'index.html': '<div class="card"></div>', 'styles.css': '.card { color: red; }' },
    explanation: 'Fixture explanation',
    gradeMode: 'auto',
    hints: ['Fixture hint'],
    relatedIds: [],
    estimatedMinutes: 5,
    tags: [],
  };
  return Object.assign({}, base, overrides);
}
