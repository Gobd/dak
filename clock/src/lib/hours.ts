import type { ClockSettings } from './settings';

export function linearHourFontSize(width: number, height: number, scale: number): number {
  return Math.min((Math.max(11, width / 40) * scale) / 100, height * 0.4);
}

// Choose a divisor of 24 so larger labels keep a regular, uncluttered rhythm.
export function hourLabelStep(span: number, labelWidth: number, minimum: number): number {
  return (
    [2, 3, 4, 6, 8, 12, 24].find(
      (step) => step >= minimum && (span * step) / 24 >= labelWidth * 1.5,
    ) ?? 24
  );
}

export function hourLabel(hour: number, format: ClockSettings['hourLabels']): string {
  return format === '12h' ? String(hour % 12 || 12) : String(hour).padStart(2, '0');
}
