import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Check for dark query param (used when embedded in dashboard)
function getThemeFromQueryParam(): Theme | null {
  if (Platform.OS !== 'web') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const dark = params.get('dark');
    if (dark === 'true' || dark === '1') return 'dark';
    if (dark === 'false' || dark === '0') return 'light';
  } catch {
    // Ignore errors
  }
  return null;
}

const queryTheme = getThemeFromQueryParam();

// If query param is present on web, persist it to storage so it survives navigation
if (queryTheme !== null && Platform.OS === 'web') {
  try {
    localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: queryTheme }, version: 0 }));
  } catch {
    // Ignore storage errors
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: queryTheme ?? 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
