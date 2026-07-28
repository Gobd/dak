import { create } from 'zustand';

interface PrivateModeState {
  isActive: boolean;
  activate: () => void;
  tryUnlock: (pin: string, storedPin: string) => boolean;
}

// Runtime-only (per-device) state - never persisted or synced to home-relay
export const usePrivateModeStore = create<PrivateModeState>((set) => ({
  isActive: false,
  activate: () => set({ isActive: true }),
  tryUnlock: (pin, storedPin) => {
    if (pin === storedPin) {
      set({ isActive: false });
      return true;
    }
    return false;
  },
}));
