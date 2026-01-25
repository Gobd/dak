import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useLocation, formatLocation } from '../../hooks/useLocation';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { LocationSettingsModal } from '../shared/LocationSettingsModal';
import { Modal, Button, Spinner } from '@dak/ui';
import type { WidgetComponentProps } from './index';

// Open-Meteo Air Quality API - free, no API key needed

interface HourEntry {
  time: Date;
  hour: number;
  aqi: number;
  isPast: boolean;
}

interface AqiApiData {
  current?: {
    us_aqi: number;
    pm2_5: number;
    pm10: number;
  };
  hourly: {
    time: string[];
    us_aqi: number[];
  };
}

function getAqiColor(aqi: number): string {
  if (aqi <= 50) return '#4ade80'; // Good - Green
  if (aqi <= 100) return '#facc15'; // Moderate - Yellow
  if (aqi <= 150) return '#f97316'; // USG - Orange
  if (aqi <= 200) return '#ef4444'; // Unhealthy - Red
  if (aqi <= 300) return '#a855f7'; // Very Unhealthy - Purple
  return '#991b1b'; // Hazardous - Maroon
}

function getAqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

async function fetchAqi(lat: number, lon: number): Promise<AqiApiData> {
  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&hourly=us_aqi&timezone=auto&forecast_days=2`,
  );
  if (!res.ok) throw new Error('Failed to fetch AQI data');
  return res.json();
}

function formatHour(h: number): string {
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${hour}${suffix}`;
}

function processAqiData(data: AqiApiData): { todayHours: HourEntry[]; tomorrowHours: HourEntry[] } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayHours: HourEntry[] = [];
  const tomorrowHours: HourEntry[] = [];

  if (!data.hourly?.time || !data.hourly?.us_aqi) {
    return { todayHours, tomorrowHours };
  }

  for (let i = 0; i < data.hourly.time.length; i++) {
    const time = new Date(data.hourly.time[i]);
    const hour = time.getHours();

    // Every 2 hours (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
    if (hour % 2 === 0) {
      const isToday = time.toDateString() === now.toDateString();
      const isTomorrow = time.toDateString() === tomorrow.toDateString();

      const entry: HourEntry = {
        time,
        hour,
        aqi: data.hourly.us_aqi[i] || 0,
        isPast: time < now,
      };

      if (isToday) todayHours.push(entry);
      else if (isTomorrow) tomorrowHours.push(entry);
    }
  }

  return { todayHours, tomorrowHours };
}

interface DayBarsProps {
  hours: HourEntry[];
  maxAqiScale?: number;
}

function DayBars({ hours, maxAqiScale = 150 }: DayBarsProps) {
  if (hours.length === 0) return null;

  const maxAqi = Math.max(...hours.map((h) => h.aqi));
  const peakIndex = hours.findIndex((h) => h.aqi === maxAqi);

  return (
    <div className="flex gap-px items-end flex-1 h-full min-h-[50px]">
      {hours.map((h, i) => {
        const height = Math.max((h.aqi / maxAqiScale) * 100, 4);
        const isPeak = i === peakIndex && maxAqi > 0;

        return (
          <div
            key={i}
            className={`relative flex-1 min-w-2 h-full flex items-end ${h.isPast ? 'opacity-50' : ''}`}
            title={`${h.hour}:00 AQI ${Math.round(h.aqi)}`}
          >
            {isPeak && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] text-text-muted whitespace-nowrap">
                {formatHour(h.hour)}
              </span>
            )}
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.min(height, 100)}%`,
                backgroundColor: getAqiColor(h.aqi),
                minHeight: '2px',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function Aqi({ panel }: WidgetComponentProps) {
  const widgetId = panel.id || 'aqi';
  const { location, setLocation } = useLocation(
    widgetId,
    panel.args?.lat as number | undefined,
    panel.args?.lon as number | undefined,
  );

  const [showSettings, setShowSettings] = useState(false);
  const [showLocationSettings, setShowLocationSettings] = useState(false);

  const {
    data: aqiData,
    isLoading,
    error,
  } = useWidgetQuery(
    ['aqi', location?.lat, location?.lon],
    () => fetchAqi(location!.lat, location!.lon),
    {
      refresh: '30m',
      enabled: !!location,
    },
  );

  if (isLoading && !aqiData) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-surface text-text`}>
        <Spinner size="md" />
      </div>
    );
  }

  if (error && !aqiData) {
    return (
      <div className={`w-full h-full p-3 bg-surface text-text`}>
        <p className="text-danger text-xs">{error.message}</p>
      </div>
    );
  }

  if (!aqiData) return null;

  const { todayHours, tomorrowHours } = processAqiData(aqiData);

  const currentAqi = Math.round(
    aqiData.current?.us_aqi ?? todayHours.find((h) => !h.isPast)?.aqi ?? tomorrowHours[0]?.aqi ?? 0,
  );
  const todayMax = todayHours.length ? Math.round(Math.max(...todayHours.map((h) => h.aqi))) : 0;
  const tomorrowMax = tomorrowHours.length
    ? Math.round(Math.max(...tomorrowHours.map((h) => h.aqi)))
    : 0;

  return (
    <div className={`w-full h-full flex flex-col gap-1 p-3 bg-surface text-text`}>
      {/* Compact header row */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold">
            {formatLocation(location.city, location.state) || 'Set Location'}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-surface-sunken/50 transition-all"
            title="Settings"
          >
            <Settings size={14} className="text-text-muted" />
          </button>
        </div>

        <span className="text-[11px] font-bold" style={{ color: getAqiColor(currentAqi) }}>
          AQI {currentAqi} {getAqiLabel(currentAqi)}
        </span>

        {todayHours.length > 0 && (
          <span className="text-[10px] text-text-muted">
            Today <b style={{ color: getAqiColor(todayMax) }}>{todayMax}</b>
          </span>
        )}
        {tomorrowHours.length > 0 && (
          <span className="text-[10px] text-text-muted">
            Tomorrow <b style={{ color: getAqiColor(tomorrowMax) }}>{tomorrowMax}</b>
          </span>
        )}
      </div>

      {/* Charts - side by side */}
      <div className="flex-1 flex gap-2 min-h-0">
        <DayBars hours={todayHours} />
        <DayBars hours={tomorrowHours} />
      </div>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Air Quality Settings"
      >
        <div className="space-y-4">
          {/* Location section */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Location</label>
            <p className="text-sm">{formatLocation(location.city, location.state) || 'Not set'}</p>
            <button
              onClick={() => {
                setShowSettings(false);
                setShowLocationSettings(true);
              }}
              className="text-sm text-accent hover:underline mt-1"
            >
              Change location...
            </button>
          </div>

          {/* Info section */}
          <details className="text-sm" open>
            <summary className="cursor-pointer text-text-muted hover:text-text-secondary">
              About AQI
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              <p>
                <b>Scale (US EPA):</b>
              </p>
              <p>
                <span style={{ color: '#4ade80' }}>0-50 Good</span> ·{' '}
                <span style={{ color: '#facc15' }}>51-100 Moderate</span> ·{' '}
                <span style={{ color: '#f97316' }}>101-150 Sensitive</span>
              </p>
              <p>
                <span style={{ color: '#ef4444' }}>151-200 Unhealthy</span> ·{' '}
                <span style={{ color: '#a855f7' }}>201-300 Very Unhealthy</span> ·{' '}
                <span style={{ color: '#991b1b' }}>301+ Hazardous</span>
              </p>
            </div>
          </details>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => setShowSettings(false)}>Close</Button>
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
