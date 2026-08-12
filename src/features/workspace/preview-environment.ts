import { DEFAULT_ENVIRONMENT, type SandboxEnvironment } from '@/runner/protocol';

/**
 * The live preview runs a REAL clock (the virtual clock is for grading determinism) at the same
 * deterministic viewport graders assume. `settings.reducedMotionPreview` forces the media feature
 * in the preview only — Submit always grades in the default environment (graders own reduced-motion
 * assertions via ctx.setReducedMotion).
 */
export function previewEnvironment(reducedMotionPreview: boolean): SandboxEnvironment {
  return {
    forcedReducedMotion: reducedMotionPreview ? true : null,
    clock: 'real',
    viewport: DEFAULT_ENVIRONMENT.viewport,
  };
}
