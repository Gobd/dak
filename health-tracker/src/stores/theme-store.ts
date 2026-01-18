import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

// Check for dark query param (used when embedded in dashboard)
function getDarkFromQueryParam(): boolean | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const dark = params.get('dark');
    if (dark === 'true' || dark === '1') return true;
    if (dark === 'false' || dark === '0') return false;
  } catch {
    // Ignore errors
  }
  return null;
}

const queryDark = getDarkFromQueryParam();

// If query param is present, persist it to storage so it survives navigation
if (queryDark !== null) {
  try {
    localStorage.setItem('theme', JSON.stringify({ state: { dark: queryDark }, version: 0 }));
  } catch {
    // Ignore storage errors
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      dark: queryDark ?? false,
      toggle: () =>
        set((state) => {
          const newDark = !state.dark;
          if (newDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { dark: newDark };
        }),
    }),
    {
      name: 'theme',
      onRehydrateStorage: () => (state) => {
        if (state?.dark) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);

// Apply initial dark mode class immediately
if (queryDark === true) {
  document.documentElement.classList.add('dark');
} else if (queryDark === false) {
  document.documentElement.classList.remove('dark');
}
