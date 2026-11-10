import type { ClockSettings } from './settings';

export function hourLabel(hour: number, format: ClockSettings['hourLabels']): string {
  return format === '12h' ? String(hour % 12 || 12) : String(hour).padStart(2, '0');
}
