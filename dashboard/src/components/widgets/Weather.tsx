import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, RefreshCw, AlertTriangle, Wind } from 'lucide-react';
import { useLocation, formatLocation } from '../../hooks/useLocation';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { LocationSettingsModal } from '../shared/LocationSettingsModal';
import { Modal, Button } from '../shared/Modal';
import type { WidgetComponentProps } from './index';

// NWS API - free, no auth, CORS-enabled
const NWS_USER_AGENT = 'Dashboard (bkemper.me)';
const CACHE_KEY = 'weather-cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface NwsPeriod {
  name: string;
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
  relativeHumidity?: { value: number };
}

interface NwsAlert {
  properties: {
    event: string;
    headline: string;
    description: string;
    instruction: string;
    severity: string;
    onset: string;
    expires: string;
  };
}

interface WeatherData {
  periods: NwsPeriod[];
  alerts: NwsAlert[];
}

function getCachedWeather(lat: number, lon: number): WeatherData | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = cache[`${lat},${lon}`];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cacheWeather(lat: number, lon: number, data: WeatherData): void {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[`${lat},${lon}`] = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const cached = getCachedWeather(lat, lon);
  if (cached) return cached;

  // Get gridpoint from coordinates
  const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: { 'User-Agent': NWS_USER_AGENT },
  });
  if (!pointRes.ok) throw new Error('Failed to get location');
  const point = await pointRes.json();

  // Get forecast
  const forecastRes = await fetch(point.properties.forecast, {
    headers: { 'User-Agent': NWS_USER_AGENT },
  });
  if (!forecastRes.ok) throw new Error('Failed to get forecast');
  const forecast = await forecastRes.json();

  // Get alerts (optional)
  let alerts: NwsAlert[] = [];
  try {
    const alertsRes = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, {
      headers: { 'User-Agent': NWS_USER_AGENT },
    });
    if (alertsRes.ok) {
      const alertsData = await alertsRes.json();
      alerts = alertsData.features || [];
    }
  } catch {
    // Alerts are optional
  }

  const data: WeatherData = {
    periods: forecast.properties.periods.slice(0, 10), // 5 days (day/night pairs)
    alerts,
  };

  cacheWeather(lat, lon, data);
  return data;
}

function getAlertSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'extreme':
      return 'bg-red-600';
    case 'severe':
      return 'bg-orange-500';
    case 'moderate':
      return 'bg-yellow-500';
    default:
      return 'bg-blue-500';
  }
}

function formatAlertTime(expires: string): string {
  const endDate = new Date(expires);
  const now = new Date();
  const remaining = endDate.getTime() - now.getTime();
  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function Weather({ panel, dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const widgetId = panel.id || 'weather';
  const layout = (panel.args?.layout as string) || 'horizontal';
  const { location, setLocation } = useLocation(
    widgetId,
    panel.args?.lat as number | undefined,
    panel.args?.lon as number | undefined
  );

  const [showSettings, setShowSettings] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<NwsPeriod | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<NwsAlert | null>(null);

  const {
    data: weather,
    isLoading,
    error,
    refetch,
  } = useWidgetQuery(
    ['weather', location?.lat, location?.lon],
    () => fetchWeather(location!.lat, location!.lon),
    {
      refresh: panel.refresh,
      enabled: !!location,
    }
  );

  const handleRefresh = () => {
    localStorage.removeItem(CACHE_KEY);
    queryClient.invalidateQueries({ queryKey: ['weather', location?.lat, location?.lon] });
  };

  if (isLoading && !weather) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}`}
      >
        <RefreshCw size={20} className="animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div
        className={`w-full h-full p-4 ${dark ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}`}
      >
        <p className="text-red-500 text-sm mb-2">{error.message}</p>
        <button onClick={() => refetch()} className="text-sm text-blue-500 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!weather) return null;

  const isVertical = layout === 'vertical';

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden ${dark ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-sm text-neutral-500 truncate">
          {formatLocation(location.city, location.state)}
        </span>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1 rounded hover:bg-neutral-700/50 shrink-0"
          title="Change location"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Alerts */}
      {weather.alerts && weather.alerts.length > 0 && (
        <div className="px-3 pb-2 space-y-1 shrink-0">
          {weather.alerts.slice(0, 3).map((alert, i) => (
            <button
              key={i}
              onClick={() => setSelectedAlert(alert)}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs text-white ${getAlertSeverityColor(alert.properties.severity)}`}
            >
              <AlertTriangle size={12} className="shrink-0" />
              <span className="truncate flex-1">{alert.properties.event}</span>
              <span className="shrink-0 opacity-75">
                {formatAlertTime(alert.properties.expires)}
              </span>
            </button>
          ))}
          {weather.alerts && weather.alerts.length > 3 && (
            <div className="text-xs text-neutral-500 px-2">
              +{weather.alerts.length - 3} more alerts
            </div>
          )}
        </div>
      )}

      {/* Forecast Periods */}
      <div
        className={`flex-1 overflow-auto px-2 pb-2 ${isVertical ? 'flex flex-col gap-1' : 'flex gap-1'}`}
      >
        {(weather.periods || []).map((period, i) => (
          <button
            key={i}
            onClick={() => setSelectedPeriod(period)}
            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-800/50 transition-colors text-left ${
              isVertical ? 'w-full' : 'flex-col min-w-[80px] flex-shrink-0'
            }`}
          >
            <div
              className={`text-xs text-neutral-400 ${isVertical ? 'w-16 shrink-0' : 'text-center'}`}
            >
              {period.name}
            </div>
            <img
              src={period.icon}
              alt={period.shortForecast}
              className={`${isVertical ? 'w-8 h-8' : 'w-10 h-10'} rounded`}
            />
            <div
              className={`font-medium ${period.isDaytime ? 'text-orange-400' : 'text-blue-400'} ${isVertical ? '' : 'text-center'}`}
            >
              {period.temperature}°{period.temperatureUnit}
            </div>
            {isVertical && (
              <div className="text-xs text-neutral-500 truncate flex-1">{period.shortForecast}</div>
            )}
          </button>
        ))}
        {/* Refresh button at end */}
        <button
          onClick={handleRefresh}
          className={`flex items-center justify-center p-2 rounded-lg hover:bg-neutral-800/50 text-neutral-500 ${
            isVertical ? 'w-full' : 'min-w-[60px] flex-shrink-0'
          }`}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Period Detail Modal */}
      <Modal
        open={!!selectedPeriod}
        onClose={() => setSelectedPeriod(null)}
        title={selectedPeriod?.name}
      >
        {selectedPeriod && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedPeriod.icon}
                alt={selectedPeriod.shortForecast}
                className="w-16 h-16 rounded-lg"
              />
              <div>
                <div
                  className={`text-3xl font-bold ${selectedPeriod.isDaytime ? 'text-orange-400' : 'text-blue-400'}`}
                >
                  {selectedPeriod.temperature}°{selectedPeriod.temperatureUnit}
                </div>
                <div className="text-neutral-400">{selectedPeriod.shortForecast}</div>
              </div>
            </div>

            {selectedPeriod.detailedForecast && (
              <p className="text-sm text-neutral-300">{selectedPeriod.detailedForecast}</p>
            )}

            {selectedPeriod.windSpeed && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Wind size={14} />
                <span>
                  {selectedPeriod.windDirection} {selectedPeriod.windSpeed}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <Button onClick={() => setSelectedPeriod(null)}>Close</Button>
        </div>
      </Modal>

      {/* Alert Detail Modal */}
      <Modal open={!!selectedAlert} onClose={() => setSelectedAlert(null)}>
        {selectedAlert && (
          <div className="space-y-4">
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${getAlertSeverityColor(selectedAlert.properties.severity)}`}
            >
              <AlertTriangle size={20} />
              <h3 className="font-bold text-lg">{selectedAlert.properties.event}</h3>
            </div>

            <div className="text-sm text-neutral-400">
              <strong>Expires:</strong>{' '}
              {new Date(selectedAlert.properties.expires).toLocaleString()}
              <br />
              <strong>Time remaining:</strong> {formatAlertTime(selectedAlert.properties.expires)}
            </div>

            {selectedAlert.properties.headline && (
              <p className="text-sm font-medium">{selectedAlert.properties.headline}</p>
            )}

            {selectedAlert.properties.description && (
              <p className="text-sm text-neutral-300 whitespace-pre-wrap max-h-48 overflow-auto">
                {selectedAlert.properties.description}
              </p>
            )}

            {selectedAlert.properties.instruction && (
              <div className="text-sm">
                <strong>Instructions:</strong>
                <p className="text-neutral-300 mt-1">{selectedAlert.properties.instruction}</p>
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <Button onClick={() => setSelectedAlert(null)}>Close</Button>
        </div>
      </Modal>

      {/* Location Settings Modal */}
      <LocationSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={setLocation}
        currentLocation={location}
      />
    </div>
  );
}
