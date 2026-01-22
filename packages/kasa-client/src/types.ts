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
  // Multi-plug/child device support
  child_id: string | null;
  // Active countdown timer
  countdown_remaining: number | null; // seconds remaining
  countdown_action: 'on' | 'off' | null; // what happens when countdown ends
  // Next scheduled action
  next_action: 'on' | 'off' | null; // next scheduled action
  next_action_at: string | null; // "sunrise", "sunset", or "HH:MM"
}

/**
 * A schedule rule for recurring on/off actions
 */
export interface ScheduleRule {
  id: string;
  enabled: boolean;
  action: 'on' | 'off';
  time: string; // HH:MM format or "sunrise"/"sunset"
  days: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  offset_mins?: number; // Offset from sunrise/sunset in minutes
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

/**
 * Format countdown remaining seconds to human-readable string
 */
export function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Format schedule time for display, handling sunrise/sunset
 */
export function formatScheduleTime(rule: ScheduleRule): string {
  if (rule.time === 'sunrise' || rule.time === 'sunset') {
    const base = rule.time === 'sunrise' ? 'Sunrise' : 'Sunset';
    if (rule.offset_mins && rule.offset_mins > 0) {
      return `${base} +${rule.offset_mins}m`;
    }
    return base;
  }
  return rule.time;
}
