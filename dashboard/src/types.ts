// Widget types
export type WidgetType =
  | 'weather'
  | 'calendar'
  | 'drive-time'
  | 'kasa'
  | 'wol'
  | 'brightness'
  | 'sun-moon'
  | 'aqi'
  | 'uv'
  | 'iframe'
  | 'climate'
  | 'timer'
  | 'ptt'
  | 'mqtt'
  | 'adguard';

// Panel configuration
export interface PanelConfig {
  id: string;
  widget: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  refresh?: string; // Duration string like "5m", "1h"
  args?: Record<string, unknown>;
}

// Default settings per widget type (used when adding new widgets)
export const WIDGET_DEFAULTS: Record<WidgetType, Partial<PanelConfig>> = {
  weather: { width: 20, height: 25, refresh: '30m' },
  calendar: { width: 30, height: 40, refresh: '5m' },
  'drive-time': { width: 6, height: 6, refresh: '5m' },
  kasa: { width: 10, height: 10, refresh: '5m' },
  wol: { width: 10, height: 10, refresh: '5m' },
  brightness: { width: 10, height: 10, refresh: '1m' },
  'sun-moon': { width: 15, height: 15, refresh: '1h' },
  aqi: { width: 15, height: 15, refresh: '30m' },
  uv: { width: 15, height: 15, refresh: '30m' },
  iframe: { width: 40, height: 40 },
  climate: { width: 20, height: 8, refresh: '1m' },
  timer: { width: 6, height: 6 },
  ptt: { width: 6, height: 6 },
  mqtt: { width: 10, height: 10, refresh: '10s' },
  adguard: { width: 6, height: 6, refresh: '10s' },
};

// Screen configuration
export interface ScreenConfig {
  id: string;
  name: string;
  panels: PanelConfig[];
}

// Drive time route configuration
export interface DriveTimeRoute {
  origin: string;
  destination: string;
  via?: string[];
  viaLabel?: string;
  days: string[];
  startTime: string;
  endTime: string;
  label?: string;
  minTimeToShow?: number;
}

// Drive time configuration
export interface DriveTimeConfig {
  locations: Record<string, string>;
  routes: DriveTimeRoute[];
}

// Calendar configuration
export interface CalendarConfig {
  hidden?: string[];
  names?: Record<string, string>;
  view?: 'month' | 'list';
  headerHeight?: number; // Extra height in pixels for header section (0-200)
}

// Location configuration (for weather widgets)
export interface LocationConfig {
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  query?: string;
}

// Brightness configuration (for auto-brightness on kiosk)
export interface BrightnessConfig {
  enabled?: boolean;
  lat?: number;
  lon?: number;
  city?: string;
  state?: string;
  locationName?: string;
  dayBrightness?: number;
  nightBrightness?: number;
  transitionMins?: number;
}

// Climate sensor configuration
export interface ClimateConfig {
  indoor?: string; // Zigbee2MQTT device friendly_name
  outdoor?: string;
  unit?: 'C' | 'F'; // Temperature unit (default: C)
}

// Theme mode for global settings
export type ThemeMode = 'dark' | 'light' | 'system';

// Wake word options (built-in, no training needed)
export type WakeWord = 'hey_jarvis' | 'alexa' | 'hey_mycroft' | 'hey_rhasspy';

// Vosk speech model options
export type VoskModel = 'small' | 'medium' | 'large';

// Vosk model metadata (returned from backend)
export interface VoskModelInfo {
  id: VoskModel;
  name: string;
  size: string;
  description: string;
  downloaded: boolean;
  downloading?: boolean;
  progress?: number; // 0-100 during download
}

// Piper TTS voice options
export type TtsVoice = 'amy' | 'danny' | 'lessac' | 'ryan';

// Voice response mode - how to show command responses
export type VoiceResponseMode = 'tts' | 'modal' | 'both' | 'none';

// Piper voice metadata (returned from backend)
export interface TtsVoiceInfo {
  id: TtsVoice;
  name: string;
  description: string;
  size: string;
  downloaded: boolean;
  downloading?: boolean;
  progress?: number; // 0-100 during download
}

// Global settings
export interface GlobalSettings {
  theme: ThemeMode;
  defaultLocation?: LocationConfig;
  hideCursor: boolean;
  relayUrl?: string;
  zigbeeUrl?: string; // Zigbee2MQTT UI URL
  // Voice control
  voiceEnabled?: boolean;
  wakeWord?: WakeWord;
  voiceModel?: VoskModel;
  ttsVoice?: TtsVoice;
  voiceResponseMode?: VoiceResponseMode;
  maxRecordingDuration?: number; // seconds, for PTT and wake word
}

// Dashboard configuration
export interface DashboardConfig {
  screens: ScreenConfig[];
  activeScreenIndex: number;
  dark: boolean;
  driveTime?: DriveTimeConfig;
  calendar?: CalendarConfig;
  climate?: ClimateConfig;
  locations?: Record<string, LocationConfig>;
  defaultLocation?: LocationConfig;
  brightness?: BrightnessConfig;
  globalSettings?: GlobalSettings;
  // Generic storage for any widget - third-party widgets can persist config here
  // Usage: widgetData['my-widget-id'] = { ...any config... }
  widgetData?: Record<string, unknown>;
}

// Default dashboard configuration (minimal fallback - actual defaults come from public/config/dashboard.json)
export const DEFAULT_CONFIG: DashboardConfig = {
  screens: [{ id: 'screen-1', name: 'Main', panels: [] }],
  activeScreenIndex: 0,
  dark: true,
};

// Duration parsing utility type
export type DurationUnit = 's' | 'm' | 'h' | 'd';

// Parse duration string to milliseconds
export function parseDuration(duration?: string): number | null {
  if (!duration) return null;
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2] as DurationUnit;

  const multipliers: Record<DurationUnit, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
