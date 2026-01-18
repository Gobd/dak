import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  relayUrl: string;
  setRelayUrl: (url: string) => void;
}

const DEFAULT_RELAY_URL = 'http://kiosk.local:5111';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      relayUrl: DEFAULT_RELAY_URL,
      setRelayUrl: (url) => set({ relayUrl: url }),
    }),
    {
      name: 'kasa-controller-settings',
    }
  )
);
