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

export const useViewStore = create<ViewStore>()(
  persist(
    (set, get) => ({
      showPrivate: true,
      setShowPrivate: (show) => set({ showPrivate: show }),
      toggleShowPrivate: () => set({ showPrivate: !get().showPrivate }),
      sortBy: 'updated',
      setSortBy: (sortBy) => set({ sortBy }),
      touchscreenMode: false,
      setTouchscreenMode: (enabled) => set({ touchscreenMode: enabled }),
    }),
    {
      name: 'view-storage',
    }
  )
);
