import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type VolumeUnit = 'ml' | 'oz';

interface PreferencesState {
  volumeUnit: VolumeUnit;
  setVolumeUnit: (unit: VolumeUnit) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      volumeUnit: 'ml',
      setVolumeUnit: (volumeUnit) => set({ volumeUnit }),
    }),
    {
      name: 'tracker-preferences',
    },
  ),
);
