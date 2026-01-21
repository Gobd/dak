import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  DashboardConfig,
  PanelConfig,
  DriveTimeConfig,
  CalendarConfig,
  LocationConfig,
  BrightnessConfig,
  GlobalSettings,
} from '../types';
import { DEFAULT_CONFIG, generateId } from '../types';

// API endpoint for home-relay config
// Priority: URL param > globalSettings > default
const DEFAULT_RELAY_URL = 'http://kiosk.home.arpa:5111';

function normalizeRelayUrl(url: string): string {
  return url.startsWith('http') ? url : `http://${url}`;
}

function getRelayUrlFromParams(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const relayParam = params.get('relay');
  return relayParam ? normalizeRelayUrl(relayParam) : null;
}

const urlParamRelay = getRelayUrlFromParams();
let relayUrl = urlParamRelay ?? DEFAULT_RELAY_URL;
if (urlParamRelay) {
  console.log(`Using relay from URL param: ${relayUrl}`);
}

// Export for widgets that need relay access (kasa, wol, brightness)
export function getRelayUrl(): string {
  return relayUrl;
}

// Update relay URL from settings (URL param always takes priority)
export function setRelayUrl(url: string) {
  if (urlParamRelay) return;
  relayUrl = normalizeRelayUrl(url);
}

// Test relay connection
export async function testRelayConnection(url?: string): Promise<boolean> {
  const testUrl = url ? normalizeRelayUrl(url) : relayUrl;
  try {
    const res = await fetch(`${testUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// SSE connection state
let sseConnection: EventSource | null = null;
let sseRetryCount = 0;
let sseRetryTimeout: ReturnType<typeof setTimeout> | null = null;
// Track save IDs we've sent to ignore our own SSE notifications
const pendingSaveIds = new Set<string>();

// Check URL params for edit mode and remote relay
const urlParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

// ============================================================================
// PERSISTED CONFIG - Add new fields to BOTH functions below
// ============================================================================

// Extract persistable config from state (for saving)
function getPersistedConfig(state: DashboardConfig): DashboardConfig {
  return {
    screens: state.screens,
    activeScreenIndex: state.activeScreenIndex,
    dark: state.dark,
    driveTime: state.driveTime,
    calendar: state.calendar,
    brightness: state.brightness,
    locations: state.locations,
    widgetData: state.widgetData,
    globalSettings: state.globalSettings,
  };
}

// Apply loaded config to state (with defaults for required fields)
function applyPersistedConfig(config: DashboardConfig): Partial<DashboardConfig> {
  return {
    screens: config.screens,
    activeScreenIndex: config.activeScreenIndex ?? 0,
    dark: config.dark ?? true,
    driveTime: config.driveTime,
    calendar: config.calendar,
    brightness: config.brightness,
    locations: config.locations,
    widgetData: config.widgetData,
    globalSettings: config.globalSettings,
  };
}

// Check if we're editing remotely (via relay param) - if so, don't subscribe to SSE
// Only the kiosk/display device should auto-refresh on config changes
const isRemoteEditing = urlParams?.has('relay') ?? false;

// Check if edit mode should be enabled via URL param
const initialEditMode = urlParams?.has('edit') ?? false;

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
  updateBrightness: (config: BrightnessConfig) => void;
  updateLocation: (widgetId: string, location: LocationConfig) => void;
  getLocation: (widgetId: string) => LocationConfig | undefined;

  // Generic widget data (for third-party widgets)
  updateWidgetData: (widgetId: string, data: unknown) => void;
  getWidgetData: <T = unknown>(widgetId: string) => T | undefined;

  // Theme
  setDark: (dark: boolean) => void;
  toggleDark: () => void;

  // Global settings
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;

  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  resetConfig: () => Promise<void>;

  // Sync
  _saveToRelay: () => Promise<void>;
  _loadFromRelay: () => Promise<boolean>;
}

export const useConfigStore = create<ConfigState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...DEFAULT_CONFIG,
        isEditMode: initialEditMode,

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

        updateBrightness: (config) =>
          set((state) => ({
            brightness: { ...state.brightness, ...config },
          })),

        updateLocation: (widgetId, location) =>
          set((state) => ({
            locations: {
              ...state.locations,
              [widgetId]: location,
            },
          })),

        getLocation: (widgetId) => get().locations?.[widgetId],

        updateWidgetData: (widgetId, data) =>
          set((state) => ({
            widgetData: {
              ...state.widgetData,
              [widgetId]: data,
            },
          })),

        getWidgetData: <T = unknown>(widgetId: string) =>
          get().widgetData?.[widgetId] as T | undefined,

        setDark: (dark) => set({ dark }),

        toggleDark: () => set((state) => ({ dark: !state.dark })),

        updateGlobalSettings: (settings) =>
          set((state) => {
            const newSettings = { ...state.globalSettings, ...settings } as GlobalSettings;
            // Sync dark boolean with theme for backwards compatibility
            const dark =
              newSettings.theme === 'dark' ||
              (newSettings.theme === 'system' &&
                (typeof window !== 'undefined'
                  ? window.matchMedia('(prefers-color-scheme: dark)').matches
                  : true));
            return { globalSettings: newSettings, dark };
          }),

        exportConfig: () => {
          return JSON.stringify(getPersistedConfig(get()), null, 2);
        },

        importConfig: (json) => {
          try {
            const config = JSON.parse(json) as DashboardConfig;
            if (!config.screens || !Array.isArray(config.screens)) {
              return false;
            }
            set(applyPersistedConfig(config));
            return true;
          } catch {
            return false;
          }
        },

        resetConfig: async () => {
          // Load default config from static file (relative path works for any deploy location)
          try {
            const res = await fetch('./config/dashboard.json');
            if (res.ok) {
              const config = (await res.json()) as DashboardConfig;
              if (config.screens && Array.isArray(config.screens)) {
                set({ ...applyPersistedConfig(config), isEditMode: false });
                return;
              }
            }
          } catch {
            // Fall back to DEFAULT_CONFIG if fetch fails
          }
          set({ ...DEFAULT_CONFIG, isEditMode: false });
        },

        // Save to relay server
        _saveToRelay: async () => {
          const config = getPersistedConfig(get());
          const saveId = crypto.randomUUID();
          pendingSaveIds.add(saveId);
          // Safety cleanup in case SSE message never arrives
          setTimeout(() => pendingSaveIds.delete(saveId), 10000);

          try {
            await fetch(`${relayUrl}/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...config, _saveId: saveId }),
            });
          } catch {
            // Relay not running, localStorage-only is fine
            pendingSaveIds.delete(saveId);
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
              set(applyPersistedConfig(config));
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
        onRehydrateStorage: () => {
          return () => {
            // Defer to next tick - store isn't fully initialized during callback
            queueMicrotask(initializeExternalConfigs);
          };
        },
      }
    )
  )
);

// Initialize external configs (static file + relay) after localStorage hydration
function initializeExternalConfigs() {
  // Apply relay URL from localStorage settings (if not overridden by URL param)
  const state = useConfigStore.getState();
  if (state.globalSettings?.relayUrl && !urlParamRelay) {
    setRelayUrl(state.globalSettings.relayUrl);
  }

  // Load static config for defaults, then relay for sync
  loadStaticConfig().then(() => {
    // Then try relay (it will override if available)
    useConfigStore
      .getState()
      ._loadFromRelay()
      .then(() => {
        // Only connect to SSE for auto-refresh if NOT editing remotely
        if (!isRemoteEditing) {
          connectToConfigUpdates();
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
}

// Auto-save to relay when config changes (debounced)
let saveDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

useConfigStore.subscribe(
  (state) => ({
    screens: state.screens,
    activeScreenIndex: state.activeScreenIndex,
    dark: state.dark,
    driveTime: state.driveTime,
    calendar: state.calendar,
    brightness: state.brightness,
    locations: state.locations,
    widgetData: state.widgetData,
    globalSettings: state.globalSettings,
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
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'config-updated') {
          // Check if this is our own save by matching the saveId
          if (data.saveId && pendingSaveIds.has(data.saveId)) {
            pendingSaveIds.delete(data.saveId);
            console.log('Ignoring SSE reload for our own save');
            return;
          }
          console.log('Config changed externally, reloading...');
          useConfigStore.getState()._loadFromRelay();
        }
      } catch {
        // Ignore non-JSON messages (keepalive, etc)
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
    // Relative path works for any deploy location (local, prod, branch deploys)
    const configUrl = './config/dashboard.json';
    const res = await fetch(configUrl);
    if (!res.ok) {
      return false;
    }
    const config = (await res.json()) as DashboardConfig;
    if (config.screens && Array.isArray(config.screens)) {
      // Only apply static config if localStorage has no real config
      // (empty panels = default/fresh install state)
      const currentState = useConfigStore.getState();
      const hasRealConfig = currentState.screens.some((s) => s.panels.length > 0);
      if (!hasRealConfig) {
        useConfigStore.setState(applyPersistedConfig(config));
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Browser event listeners
if (typeof window !== 'undefined') {
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
