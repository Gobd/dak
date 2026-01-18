import { useState } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import { useLocation, formatLocation } from '../../hooks/useLocation';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { LocationSettingsModal } from '../shared/LocationSettingsModal';
import { Modal, Button } from '../shared/Modal';
import type { WidgetComponentProps } from './index';

// Open-Meteo API - free, no API key needed
const UV_CACHE_KEY = 'uv-cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const UV_SETTINGS_KEY = 'uv-settings';

interface HourEntry {
  time: Date;
  hour: number;
  uv: number;
  isPast: boolean;
}

interface UvApiData {
  hourly: {
    time: string[];
    uv_index: number[];
  };
}

function getUvColor(uv: number): string {
  if (uv < 3) return '#4ade80';
  if (uv < 6) return '#facc15';
  if (uv < 8) return '#f97316';
  if (uv < 11) return '#ef4444';
  return '#a855f7';
}

function getUvLabel(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

function getCachedUv(lat: number, lon: number): UvApiData | null {
  try {
    const cache = JSON.parse(localStorage.getItem(UV_CACHE_KEY) || '{}');
    const entry = cache[`${lat},${lon}`];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cacheUv(lat: number, lon: number, data: UvApiData): void {
  try {
    const cache = JSON.parse(localStorage.getItem(UV_CACHE_KEY) || '{}');
    cache[`${lat},${lon}`] = { data, timestamp: Date.now() };
    localStorage.setItem(UV_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

function getSafeThreshold(widgetId: string, defaultThreshold: number): number {
  try {
    const settings = JSON.parse(localStorage.getItem(UV_SETTINGS_KEY) || '{}');
    return settings[widgetId]?.safeThreshold ?? defaultThreshold;
  } catch {
    return defaultThreshold;
  }
}

function saveSafeThreshold(widgetId: string, threshold: number): void {
  try {
    const settings = JSON.parse(localStorage.getItem(UV_SETTINGS_KEY) || '{}');
    settings[widgetId] = { ...settings[widgetId], safeThreshold: threshold };
    localStorage.setItem(UV_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

async function fetchUv(lat: number, lon: number): Promise<UvApiData> {
  const cached = getCachedUv(lat, lon);
  if (cached) return cached;

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&timezone=auto&forecast_days=2`
  );
  if (!res.ok) throw new Error('Failed to fetch UV data');
  const data = await res.json();
  cacheUv(lat, lon, data);
  return data;
}

function formatHour(h: number): string {
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${hour}${suffix}`;
}

function processUvData(data: UvApiData): { todayHours: HourEntry[]; tomorrowHours: HourEntry[] } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayHours: HourEntry[] = [];
  const tomorrowHours: HourEntry[] = [];

  if (!data.hourly?.time || !data.hourly?.uv_index) {
    return { todayHours, tomorrowHours };
  }

  for (let i = 0; i < data.hourly.time.length; i++) {
    const time = new Date(data.hourly.time[i]);
    const hour = time.getHours();

    // Every 2 hours during daylight (6, 8, 10, 12, 14, 16, 18, 20)
    if (hour >= 6 && hour <= 20 && hour % 2 === 0) {
      const isToday = time.toDateString() === now.toDateString();
      const isTomorrow = time.toDateString() === tomorrow.toDateString();

      const entry: HourEntry = {
        time,
        hour,
        uv: data.hourly.uv_index[i] || 0,
        isPast: time < now,
      };

      if (isToday) todayHours.push(entry);
      else if (isTomorrow) tomorrowHours.push(entry);
    }
  }

  return { todayHours, tomorrowHours };
}

function findThresholdCrossings(
  hours: HourEntry[],
  threshold: number
): { riseTime: number | null; fallTime: number | null } {
  const futureHours = hours.filter((h) => !h.isPast);
  if (futureHours.length < 2) return { riseTime: null, fallTime: null };

  let riseTime: number | null = null;
  let fallTime: number | null = null;

  for (let i = 1; i < futureHours.length; i++) {
    const prev = futureHours[i - 1];
    const curr = futureHours[i];

    // Crossing above threshold
    if (!riseTime && prev.uv < threshold && curr.uv >= threshold) {
      riseTime = curr.hour;
    }
    // Crossing below threshold (after rising)
    if (riseTime && !fallTime && prev.uv >= threshold && curr.uv < threshold) {
      fallTime = curr.hour;
    }
  }

  // Check if we start above threshold
  if (!riseTime && futureHours[0]?.uv >= threshold) {
    riseTime = futureHours[0].hour;
  }

  return { riseTime, fallTime };
}

interface DayBarsProps {
  hours: HourEntry[];
  maxUvScale?: number;
}

function DayBars({ hours, maxUvScale = 11 }: DayBarsProps) {
  if (hours.length === 0) return null;

  const maxUv = Math.max(...hours.map((h) => h.uv));
  const peakIndex = hours.findIndex((h) => h.uv === maxUv);

  return (
    <div className="flex gap-px items-end flex-1 h-full min-h-[50px]">
      {hours.map((h, i) => {
        const height = Math.max((h.uv / maxUvScale) * 100, 4);
        const isPeak = i === peakIndex && maxUv > 0;

        return (
          <div
            key={i}
            className={`relative flex-1 min-w-2 h-full flex items-end ${h.isPast ? 'opacity-50' : ''}`}
            title={`${h.hour}:00 UV ${h.uv.toFixed(1)}`}
          >
            {isPeak && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] text-neutral-400 whitespace-nowrap">
                {formatHour(h.hour)}
              </span>
            )}
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${height}%`,
                backgroundColor: getUvColor(h.uv),
                minHeight: '2px',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function Uv({ panel, dark }: WidgetComponentProps) {
  const widgetId = panel.id || 'uv';
  const defaultThreshold = (panel.args?.safeThreshold as number) ?? 4;
  const { location, setLocation } = useLocation(
    widgetId,
    panel.args?.lat as number | undefined,
    panel.args?.lon as number | undefined
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [safeThreshold, setSafeThreshold] = useState(() =>
    getSafeThreshold(widgetId, defaultThreshold)
  );
  const [tempThreshold, setTempThreshold] = useState(safeThreshold);

  const {
    data: uvData,
    isLoading,
    error,
  } = useWidgetQuery(
    ['uv', location?.lat, location?.lon],
    () => fetchUv(location!.lat, location!.lon),
    {
      refresh: panel.refresh,
      enabled: !!location,
    }
  );

  if (isLoading && !uvData) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
      >
        <RefreshCw size={16} className="animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error && !uvData) {
    return (
      <div
        className={`w-full h-full p-3 ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
      >
        <p className="text-red-500 text-xs">{error.message}</p>
      </div>
    );
  }

  if (!uvData) return null;

  const { todayHours, tomorrowHours } = processUvData(uvData);

  const currentUv = Math.round(todayHours.find((h) => !h.isPast)?.uv ?? tomorrowHours[0]?.uv ?? 0);
  const todayMax = todayHours.length ? Math.round(Math.max(...todayHours.map((h) => h.uv))) : 0;
  const tomorrowMax = tomorrowHours.length
    ? Math.round(Math.max(...tomorrowHours.map((h) => h.uv)))
    : 0;

  // Get threshold crossings for both days
  const todayCrossings = findThresholdCrossings(todayHours, safeThreshold);

  function formatCrossing(crossings: { riseTime: number | null; fallTime: number | null }): string {
    if (crossings.riseTime !== null && crossings.fallTime !== null) {
      return `☀️ ${formatHour(crossings.riseTime)}–${formatHour(crossings.fallTime)}`;
    } else if (crossings.riseTime !== null) {
      return `☀️ ${formatHour(crossings.riseTime)}+`;
    }
    return '';
  }

  const crossingText = formatCrossing(todayCrossings);

  return (
    <div
      className={`w-full h-full flex flex-col gap-1 p-3 ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Compact header row */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold">
            {formatLocation(location.city, location.state) || 'Set Location'}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="text-neutral-500 hover:text-neutral-300 text-sm leading-none"
            title="Settings"
          >
            <Settings size={12} />
          </button>
        </div>

        <span className="text-[11px] font-bold" style={{ color: getUvColor(currentUv) }}>
          UV {currentUv} {getUvLabel(currentUv)}
        </span>

        {crossingText && (
          <span className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
            {crossingText}
          </span>
        )}

        {todayHours.length > 0 && (
          <span className="text-[10px] text-neutral-500">
            Today <b style={{ color: getUvColor(todayMax) }}>{todayMax}</b>
          </span>
        )}
        {tomorrowHours.length > 0 && (
          <span className="text-[10px] text-neutral-500">
            Tomorrow <b style={{ color: getUvColor(tomorrowMax) }}>{tomorrowMax}</b>
          </span>
        )}
      </div>

      {/* Charts - side by side */}
      <div className="flex-1 flex gap-2 min-h-0">
        <DayBars hours={todayHours} />
        <DayBars hours={tomorrowHours} />
      </div>

      {/* Settings Modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="UV Index Settings">
        <div className="space-y-4">
          {/* Location section */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Location</label>
            <p className="text-sm">{formatLocation(location.city, location.state) || 'Not set'}</p>
            <button
              onClick={() => {
                setShowSettings(false);
                setShowLocationSettings(true);
              }}
              className="text-sm text-blue-500 hover:underline mt-1"
            >
              Change location...
            </button>
          </div>

          {/* Threshold slider */}
          <div>
            <label className="block text-sm text-neutral-400 mb-2">
              Safe UV threshold: <span className="font-bold">{tempThreshold}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={tempThreshold}
              onChange={(e) => setTempThreshold(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Times above UV {tempThreshold} will be highlighted
            </p>
          </div>

          {/* Info section */}
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-400 hover:text-neutral-300">
              About UV Index
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              <p>
                <b>☀️ Times:</b> When UV exceeds your threshold
              </p>
              <p>
                <b>Scale:</b> <span style={{ color: '#4ade80' }}>0-2 Low</span> ·{' '}
                <span style={{ color: '#facc15' }}>3-5 Mod</span> ·{' '}
                <span style={{ color: '#f97316' }}>6-7 High</span> ·{' '}
                <span style={{ color: '#ef4444' }}>8-10 V.High</span> ·{' '}
                <span style={{ color: '#a855f7' }}>11+ Extreme</span>
              </p>
            </div>
          </details>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setSafeThreshold(tempThreshold);
              saveSafeThreshold(widgetId, tempThreshold);
              setShowSettings(false);
            }}
          >
            Save
          </Button>
        </div>
      </Modal>

      {/* Location Settings Modal */}
      <LocationSettingsModal
        open={showLocationSettings}
        onClose={() => setShowLocationSettings(false)}
        onSave={setLocation}
        currentLocation={location}
      />
    </div>
  );
}
