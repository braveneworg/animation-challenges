import { describe, expect, it } from 'vitest';

import { isDarkTheme } from '@/app/theme';

describe('isDarkTheme', () => {
  it('forces dark for the dark preference regardless of the system', () => {
    expect(isDarkTheme('dark', false)).toBe(true);
    expect(isDarkTheme('dark', true)).toBe(true);
  });

  it('forces light for the light preference regardless of the system', () => {
    expect(isDarkTheme('light', false)).toBe(false);
    expect(isDarkTheme('light', true)).toBe(false);
  });

  it('follows the system for the system preference', () => {
    expect(isDarkTheme('system', true)).toBe(true);
    expect(isDarkTheme('system', false)).toBe(false);
  });
});
