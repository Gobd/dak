import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SortBy = 'updated' | 'created' | 'title';

interface ViewStore {
  showPrivate: boolean;
  setShowPrivate: (show: boolean) => void;
  toggleShowPrivate: () => void;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  // Touchscreen mode for virtual keyboard compatibility (Chromium kiosk/DAKboard)
  touchscreenMode: boolean;
  setTouchscreenMode: (enabled: boolean) => void;
}

// Check for publicOnly query param (used when embedded in dashboard iframe)
function getPublicOnlyFromQueryParam(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('publicOnly') === 'true';
  } catch {
    return false;
  }
}

const isPublicOnly = getPublicOnlyFromQueryParam();

export const useViewStore = create<ViewStore>()(
  persist(
    (set, get) => ({
      // When publicOnly query param is set, hide private notes
      showPrivate: isPublicOnly ? false : true,
      setShowPrivate: (show) => set({ showPrivate: show }),
      toggleShowPrivate: () => set({ showPrivate: !get().showPrivate }),
      sortBy: 'updated',
      setSortBy: (sortBy) => set({ sortBy }),
      touchscreenMode: false,
      setTouchscreenMode: (enabled) => set({ touchscreenMode: enabled }),
    }),
    {
      name: 'view-storage',
      // Skip persisting showPrivate when publicOnly is active (so it doesn't override the query param on reload)
      partialize: (state) =>
        isPublicOnly ? { sortBy: state.sortBy, touchscreenMode: state.touchscreenMode } : state,
    },
  ),
);
