import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export interface CreateThemeStoreOptions {
  /** localStorage key for persisting theme (e.g., 'family-chores-theme', 'theme') */
  storageKey: string;
}

/**
 * Check for dark query param (used when embedded in dashboard)
 */
function getDarkFromQueryParam(): boolean | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const dark = params.get('dark');
    if (dark === 'true' || dark === '1') return true;
    if (dark === 'false' || dark === '0') return false;
  } catch {
    // Ignore errors (SSR or no window)
  }
  return null;
}

/**
 * Factory function to create a theme store with configurable storage key.
 * Supports ?dark= query parameter for embedding in iframes.
 *
 * @example
 * ```ts
 * export const useThemeStore = createThemeStore({ storageKey: 'my-app-theme' });
 * ```
 */
export function createThemeStore(
  options: CreateThemeStoreOptions
): UseBoundStore<StoreApi<ThemeState>> {
  const { storageKey } = options;
  const queryDark = getDarkFromQueryParam();

  // If query param is present, persist it to storage so it survives navigation
  if (queryDark !== null) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ state: { dark: queryDark }, version: 0 }));
    } catch {
      // Ignore storage errors
    }
  }

  const store = create<ThemeState>()(
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
        name: storageKey,
        onRehydrateStorage: () => (state) => {
          if (state?.dark) {
            document.documentElement.classList.add('dark');
          }
        },
      }
    )
  );

  // Apply initial dark mode class immediately (for query param case)
  if (queryDark === true) {
    document.documentElement.classList.add('dark');
  } else if (queryDark === false) {
    document.documentElement.classList.remove('dark');
  }

  return store;
}
