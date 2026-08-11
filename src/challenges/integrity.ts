import { CATEGORIES, TOTAL_PLANNED_CHALLENGES } from '@/challenges/categories';
import { SERIES, SERIES_IDS } from '@/challenges/series';
import type { Challenge, ChallengeFiles } from '@/challenges/types';

/**
 * What the integrity rules read. Identical to {@link Challenge} except that `series.id` is a plain
 * `string`.
 *
 * `Challenge` types that field as `SeriesId`, which makes the "unknown series id" rule
 * unrepresentable: the compiler, not the rule, would be doing the work, and the rule could be
 * inverted or deleted without a single test noticing. Widening it here is what lets that rule be
 * exercised against a violating fixture. `Challenge` is assignable to this type, so the real
 * registry is passed straight in.
 */
export interface CatalogEntry extends Omit<Challenge, 'series'> {
  series?: { id: string; label: string } | undefined;
}

/** Deterministic code-point ordering; the default `sort` comparator is never left implicit. */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortedFileNames(files: ChallengeFiles): string[] {
  return Object.keys(files).sort(compareStrings);
}

/**
 * Key-order-independent deep equality for two file maps.
 *
 * `JSON.stringify` would be shorter but is key-order sensitive, so `{a, b}` and `{b, a}` — the same
 * files written in a different order — would compare as different and the "distinct starter and
 * solution" rule would miss a challenge that ships pre-solved.
 */
function haveIdenticalFiles(a: ChallengeFiles, b: ChallengeFiles): boolean {
  const aNames = sortedFileNames(a);
  const bNames = sortedFileNames(b);
  if (aNames.length !== bNames.length) return false;
  return aNames.every((name, index) => name === bNames[index] && a[name] === b[name]);
}

/**
 * Checks the catalog-wide invariants of spec §8.2 that can be decided from the challenge data
 * alone, and returns one human-readable message per violation — empty when the catalog is clean.
 *
 * Kept separate from its test so the rules can be exercised against hand-built violating fixtures.
 * Asserting them directly over the real registry is what let four of them run zero assertions:
 * a single challenge with `relatedIds: []`, no `series`, and `gradeMode: 'auto'` satisfies them
 * vacuously, and Vitest does not fail a test that asserts nothing.
 *
 * Spec §8.2 rule 3 (starter and solution both transpile) and rules 5 and 6 (the solution passes its
 * grader, the starter fails it) are absent: all three need the transpile worker and runner, which
 * arrive in Plan 02.
 */
export function checkCatalogIntegrity(challenges: readonly CatalogEntry[]): string[] {
  const violations: string[] = [];
  const knownIds = new Set(challenges.map((entry) => entry.id));

  const seenIds = new Set<string>();
  for (const entry of challenges) {
    if (seenIds.has(entry.id)) violations.push(`duplicate id "${entry.id}"`);
    seenIds.add(entry.id);
  }

  for (const entry of challenges) {
    for (const relatedId of entry.relatedIds) {
      if (!knownIds.has(relatedId)) {
        violations.push(`${entry.id}: relatedId "${relatedId}" does not resolve to a challenge in the catalog`);
      }
    }

    if (entry.relatedIds.includes(entry.id)) {
      violations.push(`${entry.id}: lists itself in relatedIds`);
    }

    const seriesId = entry.series?.id;
    if (seriesId !== undefined && !SERIES_IDS.some((known) => known === seriesId)) {
      violations.push(`${entry.id}: unknown series id "${seriesId}"`);
    }

    if (entry.gradeMode !== 'auto' && (entry.rubric?.length ?? 0) === 0) {
      violations.push(`${entry.id}: gradeMode "${entry.gradeMode}" requires a non-empty rubric`);
    }

    if (haveIdenticalFiles(entry.starter, entry.solution)) {
      violations.push(`${entry.id}: starter and solution are identical`);
    }

    const starterNames = sortedFileNames(entry.starter);
    const solutionNames = sortedFileNames(entry.solution);
    if (starterNames.join(', ') !== solutionNames.join(', ')) {
      violations.push(
        `${entry.id}: starter files [${starterNames.join(', ')}] do not match solution files [${solutionNames.join(', ')}]`,
      );
    }
  }

  // Series membership (spec §4.2). Ceilings and consistency, not completeness: series fill up
  // across Plans 03 and 06, so a partially authored series is legal. The last content batch owns
  // tightening member counts to equality, alongside the category ceilings.
  const membersBySeries = new Map<string, CatalogEntry[]>();
  for (const entry of challenges) {
    const ref = entry.series;
    if (ref === undefined) continue;
    const members = membersBySeries.get(ref.id) ?? [];
    members.push(entry);
    membersBySeries.set(ref.id, members);
  }

  for (const series of SERIES) {
    const members = membersBySeries.get(series.id) ?? [];

    if (members.length > series.plannedMembers) {
      violations.push(`series "${series.id}": ${members.length} members exceeds the planned ${series.plannedMembers}`);
    }

    for (const member of members) {
      if (member.series?.label !== series.label) {
        violations.push(
          `${member.id}: series label "${member.series?.label ?? ''}" does not match the series definition ` +
            `"${series.label}"`,
        );
      }
    }

    const firstInCategory = new Map<string, string>();
    for (const member of members) {
      const existing = firstInCategory.get(member.categoryId);
      if (existing === undefined) {
        firstInCategory.set(member.categoryId, member.id);
      } else {
        violations.push(
          `series "${series.id}": "${existing}" and "${member.id}" are both in category "${member.categoryId}" — ` +
            `series members must come from distinct categories (spec §4.2)`,
        );
      }
    }
  }

  // Ceilings, not equalities, and deliberately so: content arrives across six later plans, and an
  // equality check would fail every run until the final challenge lands. The last content plan is
  // what tightens these to equality.
  for (const category of CATEGORIES) {
    const actual = challenges.filter((entry) => entry.categoryId === category.id).length;
    if (actual > category.plannedCount) {
      violations.push(`${category.id}: ${actual} challenges exceeds the planned ${category.plannedCount}`);
    }
  }

  if (challenges.length > TOTAL_PLANNED_CHALLENGES) {
    violations.push(
      `catalog holds ${challenges.length} challenges, which exceeds the planned total of ${TOTAL_PLANNED_CHALLENGES}`,
    );
  }

  return violations;
}
