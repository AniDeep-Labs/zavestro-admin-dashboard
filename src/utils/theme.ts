export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';
export const THEME_STORAGE_KEY = 'zavestro-theme';

export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

export const getStoredTheme = (): 'light' | 'dark' | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : null;
};

export const setTheme = (theme: 'light' | 'dark'): void => {
  const html = document.documentElement;

  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }

  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const initTheme = (): void => {
  const stored = getStoredTheme();
  const theme = stored || getSystemTheme();
  setTheme(theme);
};

export const toggleTheme = (): void => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  setTheme(isDark ? 'light' : 'dark');
};

export const getCurrentTheme = (): 'light' | 'dark' => {
  const html = document.documentElement;
  return html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
};
