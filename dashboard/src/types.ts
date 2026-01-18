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
  | 'iframe';

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
}

// Location configuration (for weather widgets)
export interface LocationConfig {
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  query?: string;
}

// Dashboard configuration
export interface DashboardConfig {
  screens: ScreenConfig[];
  activeScreenIndex: number;
  dark: boolean;
  driveTime?: DriveTimeConfig;
  calendar?: CalendarConfig;
  locations?: Record<string, LocationConfig>;
  defaultLocation?: LocationConfig;
}

// Default dashboard configuration
export const DEFAULT_CONFIG: DashboardConfig = {
  screens: [
    {
      id: 'screen-1',
      name: 'Main',
      panels: [],
    },
  ],
  activeScreenIndex: 0,
  dark: true,
  locations: {},
};

// Widget props passed to all widgets
export interface WidgetProps {
  panel: PanelConfig;
  dark: boolean;
  isEditMode: boolean;
}

// SSE event types
export interface SSEEvent {
  type: string;
  data?: unknown;
}

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

// Format duration for display
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
