import type { CSSProperties } from 'react';
import type { ClockSettings } from './settings';

export function contrastInk(hex: string): string {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return `var(--clock-ink-${luminance > 0.179 ? 'dark' : 'light'})`;
}

export function clockColorStyles(settings: ClockSettings): CSSProperties {
  return {
    ...(settings.dayColor
      ? { '--clock-day': settings.dayColor, '--clock-day-text': contrastInk(settings.dayColor) }
      : {}),
    ...(settings.nightColor
      ? {
          '--clock-night': settings.nightColor,
          '--clock-night-text': contrastInk(settings.nightColor),
        }
      : {}),
    ...(settings.handColor ? { '--clock-hand': settings.handColor } : {}),
    ...(settings.secondColor ? { '--clock-second': settings.secondColor } : {}),
  } as CSSProperties;
}

// Resolve semantic CSS colors (including oklch) for the native hex color picker.
export function themeColorHex(token: string): string {
  const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return `#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
