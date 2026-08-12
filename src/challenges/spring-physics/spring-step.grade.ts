import type { GradeContext } from '@/sandbox/grade-context';

const DT = 1 / 60;
const STEP_COUNT = 600; // 10 simulated seconds — every reference configuration is at rest long before this

interface SpringSnapshot {
  position: number;
  velocity: number;
}

/** Narrows an unknown return value to `{ position, velocity }` without a type assertion. */
function toSnapshot(value: unknown): SpringSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const position = 'position' in value ? value.position : undefined;
  const velocity = 'velocity' in value ? value.velocity : undefined;
  if (typeof position !== 'number' || typeof velocity !== 'number') return null;
  return { position, velocity };
}

type StepFunction = (state: SpringSnapshot, config: Record<string, number>, dt: number) => SpringSnapshot | null;

function stepFunction(value: unknown): StepFunction | null {
  if (typeof value !== 'function') return null;
  return (state, config, dt) => toSnapshot(Reflect.apply(value, undefined, [state, config, dt]));
}

/** Runs `count` steps, returning the final snapshot and the maximum position seen (for overshoot checks). */
function simulate(
  step: StepFunction,
  config: Record<string, number>,
  count: number,
): { final: SpringSnapshot; maxPosition: number } | null {
  let state: SpringSnapshot = { position: 0, velocity: 0 };
  let maxPosition = state.position;
  for (let index = 0; index < count; index += 1) {
    const next = step(state, config, DT);
    if (next === null) return null;
    state = next;
    maxPosition = Math.max(maxPosition, state.position);
  }
  return { final: state, maxPosition };
}

/**
 * Grades `spring-physics/spring-step` numerically. The single-step assertion pins semi-implicit
 * Euler exactly: velocity first (5/3 after one step), then position from the NEW velocity (1/36).
 * Explicit Euler — position first, from the old velocity of 0 — would leave position at 0.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const springStep = stepFunction(ctx.moduleExports['springStep']);
  ctx.expect(springStep !== null, {
    message: '`springStep` is exported as a function from index.ts',
    hint: 'Keep the starter export: `export function springStep(state, config, dtSeconds): SpringState`.',
  });
  if (springStep === null) return;

  const original: SpringSnapshot = { position: 0, velocity: 0 };
  const oneStep = springStep(original, { target: 1, stiffness: 100, damping: 10, mass: 1 }, DT);
  ctx.expect(oneStep !== null, {
    message: '`springStep` returns a `{ position, velocity }` object',
    hint: 'Return a fresh object with numeric `position` and `velocity` fields.',
  });
  if (oneStep === null) return;

  ctx.expectClose(oneStep.velocity, 5 / 3, 1e-9, {
    message: 'One step from rest: velocity picks up acceleration × dt (5/3)',
    hint: 'Acceleration is `(springForce + dampingForce) / mass`; from rest toward target 1 with stiffness 100 that is 100, so velocity becomes 100 × (1/60).',
  });
  ctx.expectClose(oneStep.position, 1 / 36, 1e-9, {
    message: 'One step from rest: position moves by the NEW velocity × dt (1/36) — semi-implicit Euler',
    hint: 'Update velocity FIRST, then `position += newVelocity * dt`. If your position is still 0 after one step, you used the old velocity (explicit Euler).',
  });

  ctx.expect(original.position === 0 && original.velocity === 0, {
    message: 'The input state is not mutated',
    hint: 'Return a new object — do not write to `state.position` or `state.velocity`.',
    actual: `original is now { position: ${original.position}, velocity: ${original.velocity} }`,
    expected: '{ position: 0, velocity: 0 }',
  });

  // One step from rest with mass 2: the spring force alone (velocity is still 0, so damping force
  // is 0) is unchanged at 100, but acceleration is force / mass = 50 — half the mass-1 case — so
  // both the new velocity (5/6) and the position it produces (1/72) are exactly half of the
  // mass-1 scenario above. A submission that omits `/ config.mass` keeps producing 5/3 and 1/36
  // here regardless of `config.mass`, which this scenario alone catches.
  const massScaled = springStep({ position: 0, velocity: 0 }, { target: 1, stiffness: 100, damping: 10, mass: 2 }, DT);
  ctx.expect(massScaled !== null, {
    message: '`springStep` returns a `{ position, velocity }` object when `config.mass` is not 1',
    hint: 'Return a fresh object with numeric `position` and `velocity` fields, same as the mass-1 case.',
  });
  if (massScaled === null) return;

  ctx.expectClose(massScaled.velocity, 5 / 6, 1e-9, {
    message: 'One step from rest with mass 2: acceleration is halved, so velocity is 5/6 — half the mass-1 case',
    hint: 'Acceleration is `(springForce + dampingForce) / mass`. Skip the division and velocity stays 5/3 no matter what `config.mass` is.',
  });
  ctx.expectClose(massScaled.position, 1 / 72, 1e-9, {
    message: 'One step from rest with mass 2: position moves by that same halved velocity × dt (1/72)',
    hint: 'Position uses the NEW velocity: (5/6) × (1/60) = 1/72.',
  });

  const settled = simulate(springStep, { target: 1, stiffness: 170, damping: 26, mass: 1 }, STEP_COUNT);
  ctx.expect(settled !== null, {
    message: 'Repeated stepping keeps returning valid states',
    hint: 'Every call must return `{ position, velocity }` with finite numbers.',
  });
  if (settled === null) return;
  ctx.expectClose(settled.final.position, 1, 1e-3, {
    message: 'A stiffness 170 / damping 26 spring converges on its target',
    hint: 'Check the signs: the spring force must point TOWARD the target (`-stiffness * (position - target)`).',
  });
  ctx.expect(Math.abs(settled.final.velocity) < 1e-3, {
    message: 'The settled spring is at rest, not orbiting the target',
    hint: 'Damping must oppose velocity: `-damping * velocity`. A sign flip here adds energy every step.',
    actual: `velocity ${settled.final.velocity} after ${STEP_COUNT} steps`,
    expected: 'a velocity within ±0.001 of 0',
  });

  const underdamped = simulate(springStep, { target: 1, stiffness: 170, damping: 8, mass: 1 }, STEP_COUNT);
  ctx.expect(underdamped !== null && underdamped.maxPosition > 1.05, {
    message: 'With damping 8 the spring overshoots its target before settling',
    hint: 'Underdamped springs cross the target — if yours creeps up and stops, damping is being applied to position instead of velocity, or the integration order is wrong.',
    actual: underdamped === null ? 'stepping failed' : `peak position ${underdamped.maxPosition.toFixed(4)}`,
    expected: 'a peak above 1.05',
  });
}
