import { describe, expect, it } from 'vitest';

import { buildRegistry } from '@/challenges/registry';
import type { Challenge } from '@/challenges/types';

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'css-transitions/hover-lift',
    title: 'Hover lift',
    categoryId: 'css-transitions',
    difficulty: 'novice',
    tech: ['css'],
    runtime: 'dom',
    brief: 'Lift the card on hover.',
    goals: ['The card moves up on hover.'],
    starter: { 'styles.css': '.card { }' },
    solution: { 'styles.css': '.card { transition: transform 200ms; }' },
    explanation: 'Transition transform, never all.',
    gradeMode: 'auto',
    hints: [],
    relatedIds: [],
    estimatedMinutes: 5,
    tags: ['transition'],
    ...overrides,
  };
}

describe('buildRegistry', () => {
  it('collects valid challenges and indexes them by id', () => {
    const registry = buildRegistry({
      './css-transitions/hover-lift.ts': { challenge: challenge() },
    });

    expect(registry.errors).toEqual([]);
    expect(registry.challenges).toHaveLength(1);
    expect(registry.byId.get('css-transitions/hover-lift')?.title).toBe('Hover lift');
  });

  it('reports a module with no challenge export', () => {
    const registry = buildRegistry({ './css-transitions/broken.ts': {} });

    expect(registry.challenges).toHaveLength(0);
    expect(registry.errors).toHaveLength(1);
    expect(registry.errors[0]?.issues.join(' ')).toMatch(/must export a `challenge`/i);
  });

  it('reports a challenge whose id does not match its file path', () => {
    const registry = buildRegistry({
      './css-transitions/somewhere-else.ts': { challenge: challenge() },
    });

    expect(registry.errors).toHaveLength(1);
    expect(registry.errors[0]?.issues.join(' ')).toMatch(/does not match its file path/i);
  });

  it('reports schema violations without throwing', () => {
    const registry = buildRegistry({
      './css-transitions/hover-lift.ts': { challenge: { ...challenge(), goals: [] } },
    });

    expect(registry.challenges).toHaveLength(0);
    expect(registry.errors[0]?.issues.join(' ')).toMatch(/goals/i);
  });

  it('accumulates errors even when a module throws while reading its export', () => {
    const registry = buildRegistry({
      './css-transitions/aaa-broken.ts': {
        get challenge(): never {
          throw new Error('boom');
        },
      },
      './css-transitions/hover-lift.ts': { challenge: challenge() },
    });

    expect(registry.errors).toHaveLength(1);
    expect(registry.errors[0]?.modulePath).toBe('./css-transitions/aaa-broken.ts');
    expect(registry.errors[0]?.issues.join(' ')).toMatch(/threw while reading its `challenge` export/i);
    expect(registry.challenges).toHaveLength(1);
    expect(registry.challenges[0]?.id).toBe('css-transitions/hover-lift');
  });

  it('records — instead of throwing — a module whose export throws an unstringifiable value', () => {
    const hostileModule = {
      get challenge(): never {
        throw {
          toString(): string {
            throw new Error('nested');
          },
        };
      },
    };
    const registry = buildRegistry({ './css-transitions/hostile.ts': hostileModule });

    expect(registry.challenges).toEqual([]);
    expect(registry.errors).toHaveLength(1);
    expect(registry.errors[0]?.modulePath).toBe('./css-transitions/hostile.ts');
    expect(registry.errors[0]?.issues[0]).toContain('threw while reading');
  });

  it('reports a duplicate id instead of silently dropping one entry', () => {
    const registry = buildRegistry({
      './css-transitions/hover-lift.ts': { challenge: challenge() },
      'css-transitions/hover-lift.ts': { challenge: challenge() },
    });

    expect(registry.errors).toHaveLength(1);
    expect(registry.errors[0]?.issues.join(' ')).toMatch(/duplicate id/i);
    expect(registry.challenges.length).toBe(registry.byId.size);
  });

  it('indexes several challenges independently', () => {
    const registry = buildRegistry({
      './css-transitions/hover-lift.ts': { challenge: challenge() },
      './css-transitions/hover-lift-copy.ts': { challenge: challenge({ id: 'css-transitions/hover-lift-copy' }) },
    });

    expect(registry.errors).toEqual([]);
    expect(registry.challenges).toHaveLength(2);
    expect(registry.byId.size).toBe(2);
  });

  it('sorts challenges by id for stable ordering', () => {
    const registry = buildRegistry({
      './waapi/bounce-in.ts': { challenge: challenge({ id: 'waapi/bounce-in', categoryId: 'waapi' }) },
      './css-transitions/hover-lift.ts': { challenge: challenge() },
      './css-transitions/hover-lift-copy.ts': { challenge: challenge({ id: 'css-transitions/hover-lift-copy' }) },
    });

    expect(registry.challenges.map((entry) => entry.id)).toEqual([
      'css-transitions/hover-lift',
      'css-transitions/hover-lift-copy',
      'waapi/bounce-in',
    ]);
  });
});
