import { describe, expect, it } from 'vitest';

import { checkCatalogIntegrity } from '@/challenges/integrity';
import { challengeRegistry } from '@/challenges/registry';

const { challenges, errors } = challengeRegistry;

/**
 * The catalog-wide rules themselves live in `integrity.ts` and are exercised against violating
 * fixtures in `integrity.test.ts`. Asserting them here, over a real registry that currently holds
 * one challenge with `relatedIds: []`, no `series`, and `gradeMode: 'auto'`, ran several of them
 * with zero assertions — a rule could be inverted and this file would still pass.
 *
 * What is left here is the part that genuinely needs the real registry: that the modules on disk
 * load and validate, and that the rules find nothing wrong with the content actually shipped.
 */
describe('catalog integrity', () => {
  it('has no registry errors', () => {
    expect(errors).toEqual([]);
  });

  it('contains at least one challenge', () => {
    expect(challenges.length).toBeGreaterThan(0);
  });

  it('satisfies every catalog integrity rule', () => {
    expect(checkCatalogIntegrity(challenges)).toEqual([]);
  });
});
