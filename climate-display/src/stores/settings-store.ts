import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  relayUrl: string;
  setRelayUrl: (url: string) => void;
}

const DEFAULT_RELAY_URL = 'http://kiosk-relay.bkemper.me';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      relayUrl: DEFAULT_RELAY_URL,
      setRelayUrl: (url) => set({ relayUrl: url }),
    }),
    {
      name: 'climate-display-settings',
    }
  )
);
