import { useEffect } from 'react';

import type { ThemePreference } from '@/data/records';
import { useSettingsStore } from '@/stores';

export function isDarkTheme(theme: ThemePreference, systemPrefersDark: boolean): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return systemPrefersDark;
}

/**
 * Applies the persisted theme preference (Plan 04 settings store) to the document root as the
 * `.dark` class the Tailwind `dark` custom variant keys on (src/index.css), tracking the system
 * preference live while the preference is 'system'.
 */
export function useThemeEffect(): void {
  const theme = useSettingsStore((state) => state.settings.theme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      document.documentElement.classList.toggle('dark', isDarkTheme(theme, media.matches));
    };
    apply();
    media.addEventListener('change', apply);
    return (): void => media.removeEventListener('change', apply);
  }, [theme]);
}
