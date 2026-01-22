// Re-export types from generated client
export type {
  KasaDevice,
  ScheduleRule,
  ScheduleResponse,
  ToggleResponse,
  BrightnessResponse,
  CountdownResponse,
} from '@dak/api-client';

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

// Import types for use in utility functions
import type { KasaDevice, ScheduleRule } from '@dak/api-client';

/**
 * Check if a device supports brightness control
 */
export function hasBrightness(device: KasaDevice): boolean {
  return device.brightness != null || (device.features?.includes('brightness') ?? false);
}

/**
 * Check if a device has energy monitoring
 */
export function hasEnergyMonitor(device: KasaDevice): boolean {
  return device.has_emeter ?? false;
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
