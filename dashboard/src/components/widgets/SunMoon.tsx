import { useState, useMemo } from 'react';
import { useLocation, formatLocation } from '../../hooks/useLocation';
import { useRefreshInterval } from '../../hooks/useRefreshInterval';
import { LocationSettingsModal } from '../shared/LocationSettingsModal';
import type { WidgetComponentProps } from './index';

// Sun/Moon calculations based on suncalc algorithms
// All calculations done locally - no external API needed!

const PI = Math.PI;
const RAD = PI / 180;
const DAY_MS = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;
const e = RAD * 23.4397; // obliquity of Earth

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
}

function declination(l: number, b: number): number {
  return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
}

function altitude(H: number, phi: number, dec: number): number {
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + PI;
}

function julianCycle(d: number, lw: number): number {
  return Math.round(d - 0.0009 - lw / (2 * PI));
}

function approxTransit(Ht: number, lw: number, n: number): number {
  return 0.0009 + (Ht + lw) / (2 * PI) + n;
}

function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}

function hourAngle(h: number, phi: number, d: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));
}

function getSetJ(
  h: number,
  lw: number,
  phi: number,
  dec: number,
  n: number,
  M: number,
  L: number
): number {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, M, L);
}

interface SunTimes {
  sunrise: Date;
  sunset: Date;
  dawn: Date;
  dusk: Date;
  solarNoon: Date;
}

function getSunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);

  const h0 = -0.833 * RAD; // sunrise/sunset
  const h1 = -6 * RAD; // civil dawn/dusk

  const Jset = getSetJ(h0, lw, phi, dec, n, M, L);
  const Jrise = Jnoon - (Jset - Jnoon);

  const JsetDusk = getSetJ(h1, lw, phi, dec, n, M, L);
  const JriseDawn = Jnoon - (JsetDusk - Jnoon);

  return {
    solarNoon: fromJulian(Jnoon),
    sunrise: fromJulian(Jrise),
    sunset: fromJulian(Jset),
    dawn: fromJulian(JriseDawn),
    dusk: fromJulian(JsetDusk),
  };
}

// Moon calculations
interface MoonPhase {
  phase: number; // 0-1 (0 = new, 0.5 = full)
  name: string;
  icon: string;
  trend: string;
  fraction: number; // 0-1 illumination
  nextFullMoon: Date;
}

function getMoonPhase(date: Date): MoonPhase {
  const synodic = 29.53059; // days
  const known = new Date('2000-01-06T18:14:00Z'); // known new moon
  const days = (date.getTime() - known.getTime()) / DAY_MS;
  const phase = (((days % synodic) + synodic) % synodic) / synodic;

  // Determine phase name and icon
  let name = 'New';
  let icon = '○';
  let trend = '';

  if (phase < 0.03 || phase >= 0.97) {
    name = 'New';
    icon = '○';
  } else if (phase < 0.22) {
    name = 'Crescent';
    icon = '◐';
    trend = 'Growing';
  } else if (phase < 0.28) {
    name = 'Half';
    icon = '◐';
    trend = 'Growing';
  } else if (phase < 0.47) {
    name = 'Gibbous';
    icon = '◐';
    trend = 'Growing';
  } else if (phase < 0.53) {
    name = 'Full';
    icon = '●';
  } else if (phase < 0.72) {
    name = 'Gibbous';
    icon = '◑';
    trend = 'Shrinking';
  } else if (phase < 0.78) {
    name = 'Half';
    icon = '◑';
    trend = 'Shrinking';
  } else {
    name = 'Crescent';
    icon = '◑';
    trend = 'Shrinking';
  }

  // Calculate next full moon
  const daysToFull = ((0.5 - phase + 1) % 1) * synodic;
  const nextFullMoon = new Date(date.getTime() + daysToFull * DAY_MS);

  // Illumination fraction (0 at new, 1 at full)
  const fraction = (1 - Math.cos(phase * 2 * PI)) / 2;

  return { phase, name, icon, trend, fraction, nextFullMoon };
}

// Moon rise/set (simplified - needs actual ephemeris for accuracy)
interface MoonTimes {
  rise: Date | null;
  set: Date | null;
}

function getMoonTimes(date: Date, lat: number, lng: number): MoonTimes {
  // Simplified moon rise/set calculation
  // This is approximate - for accurate times, need full ephemeris
  const d = toDays(date);
  const lw = RAD * -lng;
  const phi = RAD * lat;

  // Moon's mean longitude
  const L = RAD * (218.316 + 13.176396 * d);
  // Moon's mean anomaly
  const M = RAD * (134.963 + 13.064993 * d);
  // Moon's argument of latitude
  const F = RAD * (93.272 + 13.22935 * d);

  // Moon's geocentric ecliptic longitude
  const l = L + RAD * 6.289 * Math.sin(M);
  // Moon's geocentric ecliptic latitude
  const b = RAD * 5.128 * Math.sin(F);

  const dec = declination(l, b);
  const ra = rightAscension(l, b);

  // Find rise/set times
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  let rise: Date | null = null;
  let set: Date | null = null;

  // Check each hour for rising/setting
  for (let h = 0; h < 24; h++) {
    const t1 = new Date(midnight.getTime() + h * 3600000);
    const t2 = new Date(midnight.getTime() + (h + 1) * 3600000);

    const d1 = toDays(t1);
    const d2 = toDays(t2);

    const theta1 = siderealTime(d1, lw);
    const theta2 = siderealTime(d2, lw);

    const H1 = theta1 - ra;
    const H2 = theta2 - ra;

    const alt1 = altitude(H1, phi, dec);
    const alt2 = altitude(H2, phi, dec);

    // Check for crossing horizon
    if (alt1 < 0 && alt2 >= 0 && !rise) {
      rise = new Date(t1.getTime() + ((0 - alt1) / (alt2 - alt1)) * 3600000);
    }
    if (alt1 >= 0 && alt2 < 0 && !set) {
      set = new Date(t1.getTime() + ((0 - alt1) / (alt2 - alt1)) * 3600000);
    }
  }

  return { rise, set };
}

function formatTime(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '--';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')}${ampm}`;
}

function formatDayLength(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatShortDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
}

export default function SunMoon({ panel, dark }: WidgetComponentProps) {
  const widgetId = panel.id || 'sun-moon';
  const { location, setLocation } = useLocation(
    widgetId,
    panel.args?.lat as number | undefined,
    panel.args?.lon as number | undefined
  );
  const [showSettings, setShowSettings] = useState(false);

  const data = useMemo(() => {
    if (!location) return null;

    const now = new Date();
    const sun = getSunTimes(now, location.lat, location.lon);
    const moon = getMoonPhase(now);
    const moonTimes = getMoonTimes(now, location.lat, location.lon);

    // Calculate day length
    const dayLength = (sun.sunset.getTime() - sun.sunrise.getTime()) / (1000 * 60);

    // Yesterday's day length for comparison
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const sunYesterday = getSunTimes(yesterday, location.lat, location.lon);
    const dayLengthYesterday =
      (sunYesterday.sunset.getTime() - sunYesterday.sunrise.getTime()) / (1000 * 60);
    const dayLengthChange = Math.round(dayLength - dayLengthYesterday);

    // Days to full moon
    const daysToFull = Math.round((moon.nextFullMoon.getTime() - now.getTime()) / DAY_MS);

    return {
      sun,
      moon,
      moonTimes,
      dayLength: Math.round(dayLength),
      dayLengthChange,
      daysToFull,
    };
  }, [location]);

  // Refresh periodically
  const [, forceUpdate] = useState(0);
  useRefreshInterval(() => forceUpdate((n) => n + 1), panel.refresh || '1h');

  if (!data) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
      >
        <span className="text-neutral-500 text-sm">Loading...</span>
      </div>
    );
  }

  const { sun, moon, moonTimes, dayLength, dayLengthChange, daysToFull } = data;
  const changeSign = dayLengthChange >= 0 ? '+' : '';

  return (
    <div
      className={`w-full h-full flex items-center justify-around px-4 py-2 gap-5 ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Location & Settings */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold">
          {formatLocation(location.city, location.state) || 'Set Location'}
        </span>
        <button
          onClick={() => setShowSettings(true)}
          className="text-neutral-500 hover:text-neutral-300 text-lg leading-none"
          title="Change location"
        >
          ⚙
        </button>
      </div>

      {/* Sun times */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-12 text-right text-neutral-500">Dawn</span>
          <span className="text-pink-400 font-semibold">{formatTime(sun.dawn)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-12 text-right text-neutral-500">Sunrise</span>
          <span className="text-amber-400 font-semibold">{formatTime(sun.sunrise)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-12 text-right text-neutral-500">Sunset</span>
          <span className="text-amber-400 font-semibold">{formatTime(sun.sunset)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-12 text-right text-neutral-500">Dusk</span>
          <span className="text-purple-400 font-semibold">{formatTime(sun.dusk)}</span>
        </div>
      </div>

      {/* Moon times */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 text-right text-neutral-500">Moonrise</span>
          <span className="text-violet-400 font-semibold">{formatTime(moonTimes.rise)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 text-right text-neutral-500">Moonset</span>
          <span className="text-violet-400 font-semibold">{formatTime(moonTimes.set)}</span>
        </div>
      </div>

      {/* Info section */}
      <div className="flex flex-col items-center gap-1">
        {/* Day length */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-500">Day</span>
          <span className="font-semibold">{formatDayLength(dayLength)}</span>
          <span
            className={`text-[10px] px-1 py-0.5 rounded font-semibold ${
              dayLengthChange >= 0
                ? 'text-green-400 bg-green-400/15'
                : 'text-orange-400 bg-orange-400/15'
            }`}
          >
            {changeSign}
            {dayLengthChange}m
          </span>
        </div>

        {/* Moon phase */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{moon.icon}</span>
          <span className="text-xs font-semibold">
            {moon.trend ? `${moon.trend} ${moon.name}` : moon.name}
          </span>
        </div>
        <span className="text-[10px] text-neutral-500">
          {daysToFull === 0 ? 'Full tonight' : `Full ${formatShortDate(moon.nextFullMoon)}`}
        </span>
      </div>

      {/* Location settings modal */}
      <LocationSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={setLocation}
        currentLocation={location}
      />
    </div>
  );
}
