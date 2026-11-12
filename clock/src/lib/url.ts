import {
  DATE_FORMATS,
  SIZE_RANGES,
  normalizeCalendarRelay,
  normalizeColor,
  validCoordinates,
  type ClockSettings,
} from './settings.ts';

const BOOLEAN_PARAMS = [
  'seconds',
  'wipePast',
  'showWeather',
  'showTomorrowWeather',
  'showTimeMarker',
  'showSecondsMarker',
  'showTime',
  'showSolarTimes',
  'showEventList',
  'showCalendarStatus',
  'calendarFilter',
  'showCalendarLegend',
  'showEventNames',
] as const;
const COLOR_PARAMS = [
  'dayColor',
  'nightColor',
  'handColor',
  'secondColor',
  'eventColor',
  'wipeColor',
  'barColor',
  'barTextColor',
] as const;

export function settingsFromParams(params: URLSearchParams): Partial<ClockSettings> {
  const settings: Partial<ClockSettings> = {};
  const mode = params.get('mode');
  if (mode === 'circle' || mode === 'linear') settings.mode = mode;
  const unit = params.get('weatherUnit');
  if (unit === 'fahrenheit' || unit === 'celsius') settings.weatherUnit = unit;
  const bar = params.get('rectangleBar');
  if (bar === 'top' || bar === 'bottom' || bar === 'overlay') settings.rectangleBar = bar;
  for (const key of ['barHeight', 'infoScale', 'hourLabelScale'] as const) {
    const raw = params.get(key);
    const range = SIZE_RANGES[key];
    if (
      raw?.trim() &&
      Number.isFinite(Number(raw)) &&
      Number(raw) >= range.min &&
      Number(raw) <= range.max
    )
      settings[key] = Math.round(Number(raw));
  }
  const opacity = params.get('wipeOpacity');
  if (
    opacity?.trim() &&
    Number.isFinite(Number(opacity)) &&
    Number(opacity) >= 0 &&
    Number(opacity) <= 100
  )
    settings.wipeOpacity = Math.round(Number(opacity));
  const digitalTimeFormat = params.get('digitalTimeFormat');
  if (digitalTimeFormat === '24h' || digitalTimeFormat === '12h')
    settings.digitalTimeFormat = digitalTimeFormat;
  const hourLabels = params.get('hourLabels');
  if (hourLabels === '24h' || hourLabels === '12h') settings.hourLabels = hourLabels;
  for (const key of BOOLEAN_PARAMS) {
    const value = params.get(key);
    if (value === '1' || value === '0') settings[key] = value === '1';
  }
  const format = params.get('date');
  if (format && Object.hasOwn(DATE_FORMATS, format))
    settings.dateFormat = format as ClockSettings['dateFormat'];
  if (params.has('lat') && params.has('lng')) {
    const lat = params.get('lat')!;
    const lng = params.get('lng')!;
    if (!lat.trim() && !lng.trim()) {
      settings.latitude = settings.longitude = null;
    } else if (lat.trim() && lng.trim() && validCoordinates(Number(lat), Number(lng))) {
      settings.latitude = Number(lat);
      settings.longitude = Number(lng);
    }
  }
  for (const key of COLOR_PARAMS) {
    if (params.has(key)) {
      const value = params.get(key)!;
      const color = normalizeColor(value);
      if (color || value === '') settings[key] = color;
    }
  }
  if (params.has('calendarRelay')) {
    const raw = params.get('calendarRelay')!;
    const relay = normalizeCalendarRelay(raw);
    if (relay || raw === '') settings.calendarRelay = relay;
  }
  if (params.has('calendars')) {
    try {
      const ids: unknown = JSON.parse(params.get('calendars')!);
      if (Array.isArray(ids) && ids.every((id) => typeof id === 'string'))
        settings.calendarIds = ids;
    } catch {
      /* Invalid URL filter: keep saved settings. */
    }
  }
  const style = params.get('eventStyle');
  if (style === 'band' || style === 'dot' || style === 'none') settings.eventStyle = style;
  const placement = params.get('eventPlacement');
  if (placement === 'inside' || placement === 'outside') settings.eventPlacement = placement;
  const poll = Number(params.get('calendarPollSeconds'));
  if (params.has('calendarPollSeconds') && Number.isFinite(poll) && poll >= 30 && poll <= 3600)
    settings.calendarPollSeconds = Math.round(poll);
  return settings;
}

export function displayUrl(
  base: string,
  settings: ClockSettings,
  dark: boolean,
  kiosk: boolean,
): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', settings.mode);
  url.searchParams.set('hourLabels', settings.hourLabels);
  url.searchParams.set('digitalTimeFormat', settings.digitalTimeFormat);
  url.searchParams.set('rectangleBar', settings.rectangleBar);
  for (const key of ['barHeight', 'infoScale', 'hourLabelScale'] as const)
    url.searchParams.set(key, settings[key].toString());
  url.searchParams.set('weatherUnit', settings.weatherUnit);
  url.searchParams.set('wipeOpacity', settings.wipeOpacity.toString());
  for (const key of BOOLEAN_PARAMS) url.searchParams.set(key, settings[key] ? '1' : '0');
  url.searchParams.set('date', settings.dateFormat);
  url.searchParams.set('lat', settings.latitude?.toString() ?? '');
  url.searchParams.set('lng', settings.longitude?.toString() ?? '');
  for (const key of COLOR_PARAMS) url.searchParams.set(key, settings[key] ?? '');
  url.searchParams.set('calendarRelay', settings.calendarRelay);
  url.searchParams.set('calendars', JSON.stringify(settings.calendarIds));
  url.searchParams.set('eventStyle', settings.eventStyle);
  url.searchParams.set('eventPlacement', settings.eventPlacement);
  url.searchParams.set('calendarPollSeconds', settings.calendarPollSeconds.toString());
  url.searchParams.set('theme', dark ? 'dark' : 'light');
  url.searchParams.set('f', kiosk ? '1' : '0');
  return url.toString();
}
