import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TemperatureUnit = 'C' | 'F';

interface SettingsState {
  relayUrl: string;
  unit: TemperatureUnit;
  setRelayUrl: (url: string) => void;
  setUnit: (unit: TemperatureUnit) => void;
}

const DEFAULT_RELAY_URL = 'https://kiosk-relay.bkemper.me';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      relayUrl: DEFAULT_RELAY_URL,
      unit: 'F',
      setRelayUrl: (url) => set({ relayUrl: url }),
      setUnit: (unit) => set({ unit }),
    }),
    {
      name: 'climate-display-settings',
    },
  ),
);
