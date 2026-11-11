import type { ClockSettings } from './settings';

type PaletteKey =
  | 'dayColor'
  | 'nightColor'
  | 'handColor'
  | 'secondColor'
  | 'barColor'
  | 'barTextColor'
  | 'wipeColor';
export const CLOCK_THEMES = [
  { id: 'midnight', name: 'Midnight', description: 'Dark charcoal & warm cream', dark: true },
  { id: 'paper', name: 'Paper', description: 'Bright ivory & slate', dark: false },
  { id: 'sand', name: 'Sand', description: 'Soft warm neutrals', dark: false },
  { id: 'dusk', name: 'Dusk', description: 'Muted plum & lavender', dark: true },
  {
    id: 'slate-cream',
    name: 'Slate & Cream',
    description: 'Original blue-gray & tan demos',
    dark: true,
  },
] as const;

const fields: Record<Exclude<PaletteKey, 'wipeColor'>, string> = {
  dayColor: 'day',
  nightColor: 'night',
  handColor: 'hand',
  secondColor: 'second',
  barColor: 'bar',
  barTextColor: 'text',
};

// Materialize theme tokens as editable hex values: URLs do not depend on preset IDs.
export function clockThemeColors(
  id: (typeof CLOCK_THEMES)[number]['id'],
  resolve: (token: string) => string,
): Pick<ClockSettings, PaletteKey> {
  return {
    ...Object.fromEntries(
      Object.entries(fields).map(([field, token]) => [
        field,
        resolve(`--color-clock-${id}-${token}`),
      ]),
    ),
    // Presets use the same near-black default as “Use theme wipe color”.
    // Wiping remains opt-in: palette application never changes wipePast/opacity.
    wipeColor: null,
  } as Pick<ClockSettings, PaletteKey>;
}
