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
] as const;

const fields: Record<PaletteKey, string> = {
  dayColor: 'day',
  nightColor: 'night',
  handColor: 'hand',
  secondColor: 'second',
  barColor: 'bar',
  barTextColor: 'text',
  wipeColor: 'wipe',
};

// Materialize theme tokens as editable hex values: URLs do not depend on preset IDs.
export function clockThemeColors(
  id: (typeof CLOCK_THEMES)[number]['id'],
  resolve: (token: string) => string,
): Pick<ClockSettings, PaletteKey> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, token]) => [
      field,
      resolve(`--color-clock-${id}-${token}`),
    ]),
  ) as Pick<ClockSettings, PaletteKey>;
}
