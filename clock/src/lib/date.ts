import type { ClockSettings } from './settings';

export function formatClockDate(date: Date, format: ClockSettings['dateFormat']): string {
  if (format === 'none') return '';
  if (format === 'iso') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  const options: Record<
    Exclude<ClockSettings['dateFormat'], 'none' | 'iso'>,
    Intl.DateTimeFormatOptions
  > = {
    weekday: { weekday: 'long' },
    monthDay: { month: 'long', day: 'numeric' },
    weekdayDate: { weekday: 'long', month: 'long', day: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    numeric: { year: 'numeric', month: '2-digit', day: '2-digit' },
  };
  return new Intl.DateTimeFormat(undefined, options[format]).format(date);
}
