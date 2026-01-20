/**
 * Kasa device information returned from discovery/status endpoints
 */
export interface KasaDevice {
  ip: string;
  name: string;
  on: boolean;
  model: string;
  type: string;
  // Extended info
  on_since: string | null;
  brightness: number | null;
  color_temp: number | null;
  has_emeter: boolean;
  power_watts: number | null;
  energy_today_kwh: number | null;
  features: string[];
}

/**
 * A schedule rule for recurring on/off actions
 */
export interface ScheduleRule {
  id: string;
  enabled: boolean;
  action: 'on' | 'off';
  time: string; // HH:MM format
  days: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
}

/**
 * Response from schedule endpoints
 */
export interface ScheduleResponse {
  ip: string;
  name: string;
  rules: ScheduleRule[];
}

/**
 * Response from toggle endpoint
 */
export interface ToggleResponse {
  ip: string;
  on: boolean;
  name: string;
  on_since: string | null;
  brightness: number | null;
}

/**
 * Response from brightness endpoint
 */
export interface BrightnessResponse {
  ip: string;
  name: string;
  brightness: number;
  on: boolean;
}

/**
 * Response from countdown endpoint
 */
export interface CountdownResponse {
  ip: string;
  name: string;
  minutes: number;
  action: string;
  enabled: boolean;
}

/**
 * Day abbreviations used in schedules
 */
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Day = (typeof DAYS)[number];

/**
 * Day labels for UI display
 */
export const DAY_LABELS: Record<Day, string> = {
  sun: 'S',
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
};

/**
 * Check if a device supports brightness control
 */
export function hasBrightness(device: KasaDevice): boolean {
  return device.brightness !== null || device.features.includes('brightness');
}

/**
 * Check if a device has energy monitoring
 */
export function hasEnergyMonitor(device: KasaDevice): boolean {
  return device.has_emeter;
}

/**
 * Format duration from ISO timestamp to human-readable string
 */
export function formatDuration(isoString: string): string {
  const start = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
