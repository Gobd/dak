export const DATE_FORMATS = {
  none: 'Hidden',
  weekday: 'Weekday only',
  monthDay: 'Month + day',
  weekdayDate: 'Weekday + date',
  full: 'Full date with year',
  numeric: 'Short numeric date',
  iso: 'ISO date (YYYY-MM-DD)',
} as const;

export interface ClockSettings {
  mode: 'circle' | 'linear';
  hourLabels: '24h' | '12h';
  seconds: boolean;
  showTime: boolean;
  showSolarTimes: boolean;
  dateFormat: keyof typeof DATE_FORMATS;
  dayColor: string | null;
  nightColor: string | null;
  handColor: string | null;
  secondColor: string | null;
  latitude: number | null;
  longitude: number | null;
  calendarRelay: string;
  calendarKey: string;
  calendarIds: string[];
  calendarFilter: boolean;
  showCalendarLegend: boolean;
  showEventNames: boolean;
  eventStyle: 'band' | 'dot' | 'none';
  eventPlacement: 'inside' | 'outside';
  eventColor: string | null;
  showEventList: boolean;
  showCalendarStatus: boolean;
  calendarPollSeconds: number;
}

export const DEFAULT_SETTINGS: ClockSettings = {
  mode: 'circle',
  hourLabels: '24h',
  seconds: true,
  showTime: true,
  showSolarTimes: false,
  dateFormat: 'none',
  dayColor: null,
  nightColor: null,
  handColor: null,
  secondColor: null,
  latitude: null,
  longitude: null,
  calendarRelay: '',
  calendarKey: '',
  calendarIds: [],
  calendarFilter: false,
  showCalendarLegend: false,
  showEventNames: false,
  eventStyle: 'band',
  eventPlacement: 'outside',
  eventColor: null,
  showEventList: false,
  showCalendarStatus: true,
  calendarPollSeconds: 60,
};

export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  );
}

export function normalizeColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export function normalizeCalendarRelay(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

// localStorage can contain an older schema, malformed values, or even null.
export function normalizeSettings(value: unknown): ClockSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const settings = value as Partial<ClockSettings>;
  const located = validCoordinates(settings.latitude, settings.longitude);
  return {
    mode: settings.mode === 'linear' ? 'linear' : 'circle',
    hourLabels: settings.hourLabels === '12h' ? '12h' : '24h',
    seconds: typeof settings.seconds === 'boolean' ? settings.seconds : true,
    showTime: typeof settings.showTime === 'boolean' ? settings.showTime : true,
    showSolarTimes: typeof settings.showSolarTimes === 'boolean' ? settings.showSolarTimes : false,
    dateFormat:
      typeof settings.dateFormat === 'string' && Object.hasOwn(DATE_FORMATS, settings.dateFormat)
        ? settings.dateFormat
        : 'none',
    dayColor: normalizeColor(settings.dayColor),
    nightColor: normalizeColor(settings.nightColor),
    handColor: normalizeColor(settings.handColor),
    secondColor: normalizeColor(settings.secondColor),
    latitude: located ? settings.latitude! : null,
    longitude: located ? settings.longitude! : null,
    calendarRelay: normalizeCalendarRelay(settings.calendarRelay),
    calendarKey:
      typeof settings.calendarKey === 'string' ? settings.calendarKey.trim().slice(0, 256) : '',
    calendarIds: Array.isArray(settings.calendarIds)
      ? [
          ...new Set(
            settings.calendarIds.filter(
              (id): id is string => typeof id === 'string' && id.length <= 256,
            ),
          ),
        ].slice(0, 100)
      : [],
    calendarFilter:
      typeof settings.calendarFilter === 'boolean'
        ? settings.calendarFilter
        : Array.isArray(settings.calendarIds) && settings.calendarIds.length > 0,
    showCalendarLegend:
      typeof settings.showCalendarLegend === 'boolean' ? settings.showCalendarLegend : false,
    showEventNames: typeof settings.showEventNames === 'boolean' ? settings.showEventNames : false,
    eventStyle:
      settings.eventStyle === 'dot' || settings.eventStyle === 'none'
        ? settings.eventStyle
        : 'band',
    eventPlacement: settings.eventPlacement === 'inside' ? 'inside' : 'outside',
    eventColor: normalizeColor(settings.eventColor),
    showEventList: typeof settings.showEventList === 'boolean' ? settings.showEventList : false,
    showCalendarStatus:
      typeof settings.showCalendarStatus === 'boolean' ? settings.showCalendarStatus : true,
    calendarPollSeconds:
      typeof settings.calendarPollSeconds === 'number' &&
      Number.isFinite(settings.calendarPollSeconds)
        ? Math.max(30, Math.min(3600, Math.round(settings.calendarPollSeconds)))
        : 60,
  };
}
