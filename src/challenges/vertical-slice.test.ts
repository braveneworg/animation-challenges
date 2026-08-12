import { describe, expect, it } from 'vitest';

import { challengeRegistry } from '@/challenges/registry';

/** Every challenge shipped by Plans 01–03. Plan 06 appends; it never removes. */
const SLICE_IDS = [
  'css-transitions/hover-lift',
  'css-keyframes/bounce-in',
  'waapi/bounce-in',
  'motion-react-basics/bounce-in-spring',
  'easing-math/lerp',
  'spring-physics/spring-step',
  'tailwind-basics/hover-transition',
  'tailwind-custom/theme-pulse',
  'raf-tweening/first-loop',
  'motion-core/first-animate',
  'easing-timing/overshoot-bezier',
  'easing-timing/snappy-ease',
  'transforms-3d/card-flip',
  'svg-animation/line-draw',
  'scroll-driven/scroll-progress',
  'accessibility/reduced-motion-swap',
  'interruption-state/reversible-hover',
] as const;

describe('vertical slice coverage', () => {
  it('keeps every slice challenge in the registry', () => {
    for (const id of SLICE_IDS) {
      expect(challengeRegistry.byId.has(id), `missing ${id}`).toBe(true);
    }
  });

  it('covers all three runtimes', () => {
    const runtimes = new Set(challengeRegistry.challenges.map((entry) => entry.runtime));
    expect(runtimes).toEqual(new Set(['dom', 'react', 'module']));
  });

  it('covers all three grade modes', () => {
    const modes = new Set(challengeRegistry.challenges.map((entry) => entry.gradeMode));
    expect(modes).toEqual(new Set(['auto', 'rubric', 'hybrid']));
  });

  it('ships the bounce-in series complete: three members in three distinct categories', () => {
    const members = challengeRegistry.challenges.filter((entry) => entry.series?.id === 'bounce-in');
    expect(members.map((entry) => entry.id).sort()).toEqual([
      'css-keyframes/bounce-in',
      'motion-react-basics/bounce-in-spring',
      'waapi/bounce-in',
    ]);
    expect(new Set(members.map((entry) => entry.categoryId)).size).toBe(3);
  });
});
