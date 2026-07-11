/**
 * Utility functions for dark/light theme management.
 * Shared between InfoComponent and any future consumers.
 */

const THEME_STORAGE_KEY = 'theme';

/**
 * Reads the stored theme preference from localStorage.
 * Defaults to dark mode if nothing is stored.
 */
export function readStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored ? stored === 'dark' : true;
  } catch {
    return true;
  }
}

/**
 * Applies the given dark-mode state to the document root and
 * persists it to localStorage.
 */
export function applyTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch {
    /* ignore */
  }
}
