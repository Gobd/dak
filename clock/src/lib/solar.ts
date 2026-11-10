import SunCalc from 'suncalc';

export interface SolarDay {
  daylight: { start: number; end: number }[];
  events: { kind: 'sunrise' | 'sunset'; time: Date; fraction: number }[];
  state: 'normal' | 'polar-day' | 'polar-night';
}

// Both clocks use local wall time, not elapsed milliseconds (important on DST days).
export function dayFraction(date: Date): number {
  return (
    (date.getHours() * 3600 +
      date.getMinutes() * 60 +
      date.getSeconds() +
      date.getMilliseconds() / 1000) /
    86400
  );
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getTimezoneOffset()}`;
}

export function getSolarDay(date: Date, latitude: number, longitude: number): SolarDay {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const events: SolarDay['events'] = [];
  const seen = new Set<number>();

  // A solar day need not line up with the browser's timezone. Include neighboring
  // solar cycles so sunset-before-sunrise and dates near the date line work too.
  for (let offset = -2; offset <= 2; offset++) {
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
    const times = SunCalc.getTimes(noon, latitude, longitude);
    for (const kind of ['sunrise', 'sunset'] as const) {
      const time = times[kind];
      const stamp = time.getTime();
      if (stamp >= start.getTime() && stamp < end.getTime() && !seen.has(stamp)) {
        seen.add(stamp);
        events.push({ kind, time, fraction: dayFraction(time) });
      }
    }
  }
  events.sort((a, b) => a.time.getTime() - b.time.getTime());

  let isDay = SunCalc.getPosition(start, latitude, longitude).altitude >= (-0.833 * Math.PI) / 180;
  const daylight: SolarDay['daylight'] = [];
  let from = 0;
  for (const event of events) {
    if (isDay && event.fraction > from) daylight.push({ start: from, end: event.fraction });
    from = event.fraction;
    isDay = event.kind === 'sunrise';
  }
  if (isDay && from < 1) daylight.push({ start: from, end: 1 });
  return {
    daylight,
    events,
    state: events.length ? 'normal' : daylight.length ? 'polar-day' : 'polar-night',
  };
}
