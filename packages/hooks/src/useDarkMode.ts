import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useMediaQuery } from './useMediaQuery';

/**
 * Manages dark mode state with localStorage persistence.
 * Falls back to system preference if no stored value exists.
 * Automatically toggles the 'dark' class on document.documentElement.
 *
 * @param storageKey - localStorage key for persistence (default: 'dark-mode')
 */
export function useDarkMode(storageKey = 'dark-mode'): [boolean, (value: boolean) => void] {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [isDark, setIsDark] = useLocalStorage<boolean | null>(storageKey, null);

  // Resolve actual dark mode: stored preference or system preference
  const resolvedDark = isDark ?? prefersDark;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedDark);
  }, [resolvedDark]);

  return [resolvedDark, setIsDark];
}
