import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  DashboardConfig,
  ScreenConfig,
  PanelConfig,
  DriveTimeConfig,
  CalendarConfig,
  LocationConfig,
} from '../types';
import { DEFAULT_CONFIG, generateId } from '../types';

// API endpoint for home-relay config
// Can be overridden with ?relay=host:port URL param for remote editing
const DEFAULT_RELAY_URL = 'http://localhost:5111';

function getRelayUrlFromParams(): string {
  if (typeof window === 'undefined') return DEFAULT_RELAY_URL;
  const params = new URLSearchParams(window.location.search);
  const relayParam = params.get('relay');
  if (relayParam) {
    return relayParam.startsWith('http') ? relayParam : `http://${relayParam}`;
  }
  return DEFAULT_RELAY_URL;
}

let relayUrl = DEFAULT_RELAY_URL;
if (typeof window !== 'undefined') {
  relayUrl = getRelayUrlFromParams();
  if (relayUrl !== DEFAULT_RELAY_URL) {
    console.log(`Using remote relay: ${relayUrl}`);
  }
}

// Export for widgets that need relay access (kasa, wol, brightness)
export function getRelayUrl(): string {
  return relayUrl;
}

// SSE connection state
let sseConnection: EventSource | null = null;
let sseRetryCount = 0;
let sseRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let ignoreSseReload = false;
let ignoreSseTimeout: ReturnType<typeof setTimeout> | null = null;

// Check if we're editing remotely (via relay param) - if so, don't subscribe to SSE
// Only the kiosk/display device should auto-refresh on config changes
const isRemoteEditing =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('relay');

interface ConfigState extends DashboardConfig {
  // Edit mode
  isEditMode: boolean;
  setEditMode: (editing: boolean) => void;

  // Screen actions
  addScreen: (name: string) => void;
  removeScreen: (index: number) => void;
  setActiveScreen: (index: number) => void;
  renameScreen: (index: number, name: string) => void;

  // Panel actions
  addPanel: (panel: Omit<PanelConfig, 'id'>) => void;
  updatePanel: (panelId: string, updates: Partial<PanelConfig>) => void;
  removePanel: (panelId: string) => void;
  movePanel: (panelId: string, x: number, y: number) => void;
  resizePanel: (panelId: string, width: number, height: number) => void;

  // Config sections
  updateDriveTime: (config: DriveTimeConfig) => void;
  updateCalendar: (config: CalendarConfig) => void;
  updateLocation: (widgetId: string, location: LocationConfig) => void;
  getLocation: (widgetId: string) => LocationConfig | undefined;

  // Theme
  setDark: (dark: boolean) => void;
  toggleDark: () => void;

  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  resetConfig: () => void;

  // Sync
  _saveToRelay: () => Promise<void>;
  _loadFromRelay: () => Promise<boolean>;
}

export const useConfigStore = create<ConfigState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...DEFAULT_CONFIG,
        isEditMode: false,

        setEditMode: (editing) => set({ isEditMode: editing }),

        addScreen: (name) =>
          set((state) => ({
            screens: [
              ...state.screens,
              {
                id: `screen-${generateId()}`,
                name,
                panels: [],
              },
            ],
          })),

        removeScreen: (index) =>
          set((state) => {
            if (state.screens.length <= 1) return state;
            const screens = state.screens.filter((_, i) => i !== index);
            const activeScreenIndex = Math.min(state.activeScreenIndex, screens.length - 1);
            return { screens, activeScreenIndex };
          }),

        setActiveScreen: (index) =>
          set((state) => {
            const newIndex = Math.max(0, Math.min(index, state.screens.length - 1));
            // Update URL with screen index
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('screen', String(newIndex));
              window.history.pushState({}, '', url);
            }
            return { activeScreenIndex: newIndex };
          }),

        renameScreen: (index, name) =>
          set((state) => ({
            screens: state.screens.map((screen, i) => (i === index ? { ...screen, name } : screen)),
          })),

        addPanel: (panel) =>
          set((state) => {
            const newPanel: PanelConfig = {
              ...panel,
              id: `panel-${generateId()}`,
            };
            return {
              screens: state.screens.map((screen, i) =>
                i === state.activeScreenIndex
                  ? { ...screen, panels: [...screen.panels, newPanel] }
                  : screen
              ),
            };
          }),

        updatePanel: (panelId, updates) =>
          set((state) => ({
            screens: state.screens.map((screen) => ({
              ...screen,
              panels: screen.panels.map((panel) =>
                panel.id === panelId ? { ...panel, ...updates } : panel
              ),
            })),
          })),

        removePanel: (panelId) =>
          set((state) => ({
            screens: state.screens.map((screen) => ({
              ...screen,
              panels: screen.panels.filter((panel) => panel.id !== panelId),
            })),
          })),

        movePanel: (panelId, x, y) =>
          set((state) => ({
            screens: state.screens.map((screen) => ({
              ...screen,
              panels: screen.panels.map((panel) =>
                panel.id === panelId ? { ...panel, x, y } : panel
              ),
            })),
          })),

        resizePanel: (panelId, width, height) =>
          set((state) => ({
            screens: state.screens.map((screen) => ({
              ...screen,
              panels: screen.panels.map((panel) =>
                panel.id === panelId ? { ...panel, width, height } : panel
              ),
            })),
          })),

        updateDriveTime: (config) => set({ driveTime: config }),

        updateCalendar: (config) =>
          set((state) => ({
            calendar: { ...state.calendar, ...config },
          })),

        updateLocation: (widgetId, location) =>
          set((state) => ({
            locations: {
              ...state.locations,
              [widgetId]: location,
            },
          })),

        getLocation: (widgetId) => get().locations?.[widgetId],

        setDark: (dark) => set({ dark }),

        toggleDark: () => set((state) => ({ dark: !state.dark })),

        exportConfig: () => {
          const state = get();
          const config: DashboardConfig = {
            screens: state.screens,
            activeScreenIndex: state.activeScreenIndex,
            dark: state.dark,
            driveTime: state.driveTime,
            calendar: state.calendar,
            locations: state.locations,
          };
          return JSON.stringify(config, null, 2);
        },

        importConfig: (json) => {
          try {
            const config = JSON.parse(json) as DashboardConfig;
            // Validate basic structure
            if (!config.screens || !Array.isArray(config.screens)) {
              return false;
            }
            set({
              screens: config.screens,
              activeScreenIndex: config.activeScreenIndex ?? 0,
              dark: config.dark ?? true,
              driveTime: config.driveTime,
              calendar: config.calendar,
              locations: config.locations,
            });
            return true;
          } catch {
            return false;
          }
        },

        resetConfig: () =>
          set({
            ...DEFAULT_CONFIG,
            isEditMode: false,
          }),

        // Save to relay server
        _saveToRelay: async () => {
          const state = get();
          const config: DashboardConfig = {
            screens: state.screens,
            activeScreenIndex: state.activeScreenIndex,
            dark: state.dark,
            driveTime: state.driveTime,
            calendar: state.calendar,
            locations: state.locations,
          };

          // Set flag to ignore our own SSE reload
          ignoreSseReload = true;
          if (ignoreSseTimeout) clearTimeout(ignoreSseTimeout);
          ignoreSseTimeout = setTimeout(() => {
            ignoreSseReload = false;
            ignoreSseTimeout = null;
          }, 2000);

          try {
            await fetch(`${relayUrl}/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(config),
            });
          } catch {
            // Relay not running, localStorage-only is fine
          }
        },

        // Load from relay server
        _loadFromRelay: async () => {
          try {
            const res = await fetch(`${relayUrl}/config`, {
              method: 'GET',
              headers: { Accept: 'application/json' },
            });
            if (!res.ok) return false;
            const config = (await res.json()) as DashboardConfig;
            if (config.screens && Array.isArray(config.screens)) {
              set({
                screens: config.screens,
                activeScreenIndex: config.activeScreenIndex ?? 0,
                dark: config.dark ?? true,
                driveTime: config.driveTime,
                calendar: config.calendar,
                locations: config.locations,
              });
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
      }),
      {
        name: 'dashboard-config',
      }
    )
  )
);

// Auto-save to relay when config changes (debounced)
let saveDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

useConfigStore.subscribe(
  (state) => ({
    screens: state.screens,
    activeScreenIndex: state.activeScreenIndex,
    dark: state.dark,
    driveTime: state.driveTime,
    calendar: state.calendar,
    locations: state.locations,
  }),
  () => {
    // Debounce saves to avoid excessive API calls
    if (saveDebounceTimeout) clearTimeout(saveDebounceTimeout);
    saveDebounceTimeout = setTimeout(() => {
      useConfigStore.getState()._saveToRelay();
    }, 500);
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
);

// SSE connection for live config updates
function connectToConfigUpdates() {
  if (typeof window === 'undefined') return;

  if (sseConnection) {
    sseConnection.close();
  }
  if (sseRetryTimeout) {
    clearTimeout(sseRetryTimeout);
    sseRetryTimeout = null;
  }

  try {
    sseConnection = new EventSource(`${relayUrl}/config/subscribe`);

    sseConnection.onopen = () => {
      console.log('SSE connected');
      sseRetryCount = 0;
    };

    sseConnection.onmessage = (event) => {
      if (event.data === 'reload') {
        if (ignoreSseReload) {
          console.log('Ignoring SSE reload for our own save');
          return;
        }
        console.log('Config changed externally, reloading...');
        useConfigStore.getState()._loadFromRelay();
      }
    };

    sseConnection.onerror = () => {
      console.log('SSE disconnected, will retry...');
      sseConnection?.close();
      sseRetryCount++;
      const delay = Math.min(1000 * Math.pow(2, sseRetryCount - 1), 30000);
      console.log(`SSE retry in ${delay}ms`);
      sseRetryTimeout = setTimeout(connectToConfigUpdates, delay);
    };
  } catch (err) {
    console.warn('SSE not available:', err);
  }
}

// Cleanup SSE on page unload
function cleanupSSE() {
  if (sseRetryTimeout) {
    clearTimeout(sseRetryTimeout);
    sseRetryTimeout = null;
  }
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
}

// Load from static config file as fallback
async function loadStaticConfig(): Promise<boolean> {
  try {
    // Use Vite's base URL (/ in dev, /dashboard/ in prod)
    const baseUrl = import.meta.env.BASE_URL || '/';
    const configUrl = `${baseUrl}config/dashboard.json`;
    console.log('Loading static config from', configUrl);
    const res = await fetch(configUrl);
    if (!res.ok) {
      console.error('Failed to load static config:', res.status, res.statusText);
      return false;
    }
    const config = (await res.json()) as DashboardConfig;
    console.log('Static config loaded:', config);
    if (config.screens && Array.isArray(config.screens)) {
      useConfigStore.setState({
        screens: config.screens,
        activeScreenIndex: config.activeScreenIndex ?? 0,
        dark: config.dark ?? true,
        driveTime: config.driveTime,
        calendar: config.calendar,
        locations: config.locations,
      });
      console.log('Config applied to store');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error loading static config:', err);
    return false;
  }
}

// Initialize config and SSE connection
if (typeof window !== 'undefined') {
  // Always try to load static config first for defaults, then relay can override
  loadStaticConfig().then((staticLoaded) => {
    console.log('Static config load result:', staticLoaded);
    console.log('Current store state after static load:', {
      screens: useConfigStore.getState().screens.length,
      locations: Object.keys(useConfigStore.getState().locations ?? {}),
    });

    // Then try relay (it will override if available)
    useConfigStore
      .getState()
      ._loadFromRelay()
      .then((loaded) => {
        console.log('Relay load result:', loaded);
        console.log('Current store state after relay load:', {
          screens: useConfigStore.getState().screens.length,
          locations: Object.keys(useConfigStore.getState().locations ?? {}),
        });

        // Only connect to SSE for auto-refresh if NOT editing remotely
        if (!isRemoteEditing) {
          connectToConfigUpdates();
        } else {
          console.log('Remote editing mode - SSE refresh disabled');
        }

        // Apply screen index from URL after config is loaded
        const urlParams = new URLSearchParams(window.location.search);
        const screenParam = urlParams.get('screen');
        if (screenParam !== null) {
          const screenIndex = parseInt(screenParam, 10);
          if (!isNaN(screenIndex)) {
            const state = useConfigStore.getState();
            const validIndex = Math.max(0, Math.min(screenIndex, state.screens.length - 1));
            useConfigStore.setState({ activeScreenIndex: validIndex });
          }
        }
      });
  });

  // Handle browser back/forward navigation
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const screenParam = urlParams.get('screen');
    if (screenParam !== null) {
      const screenIndex = parseInt(screenParam, 10);
      if (!isNaN(screenIndex)) {
        const state = useConfigStore.getState();
        const validIndex = Math.max(0, Math.min(screenIndex, state.screens.length - 1));
        useConfigStore.setState({ activeScreenIndex: validIndex });
      }
    }
  });

  window.addEventListener('beforeunload', cleanupSSE);
  window.addEventListener('pagehide', cleanupSSE);
}

// Selector for current screen
export const useCurrentScreen = (): ScreenConfig => {
  const screens = useConfigStore((state) => state.screens);
  const activeScreenIndex = useConfigStore((state) => state.activeScreenIndex);
  return screens[activeScreenIndex] ?? screens[0];
};

// Selector for current panels
export const useCurrentPanels = (): PanelConfig[] => {
  const screen = useCurrentScreen();
  return screen?.panels ?? [];
};
