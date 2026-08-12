import { describe, expect, it } from 'vitest';

import { previewEnvironment } from '@/features/workspace/preview-environment';
import { DEFAULT_ENVIRONMENT } from '@/runner/protocol';

describe('previewEnvironment', () => {
  it('runs a real clock at the default deterministic viewport', () => {
    const environment = previewEnvironment(false);
    expect(environment.clock).toBe('real');
    expect(environment.viewport).toEqual(DEFAULT_ENVIRONMENT.viewport);
    expect(environment.forcedReducedMotion).toBeNull();
  });

  it('forces reduced motion only when the preview default asks for it', () => {
    expect(previewEnvironment(true).forcedReducedMotion).toBe(true);
  });
});
