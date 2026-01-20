import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, RefreshCw, AlertTriangle, Wind } from 'lucide-react';
import { useLocation, formatLocation } from '../../hooks/useLocation';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { LocationSettingsModal } from '../shared/LocationSettingsModal';
import { Modal, Button } from '@dak/ui';
import type { WidgetComponentProps } from './index';

// NWS API - free, no auth, CORS-enabled
const APP_URL = import.meta.env.VITE_APP_URL || 'https://example.com';
const NWS_USER_AGENT = `Dashboard (${APP_URL.replace(/^https?:\/\//, '')})`;

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

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
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

  return {
    periods: forecast.properties.periods.slice(0, 10), // 5 days (day/night pairs)
    alerts,
  };
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
      refresh: '30m',
      enabled: !!location,
    }
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['weather', location?.lat, location?.lon] });
  };

  if (isLoading && !weather) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
      >
        <RefreshCw size={20} className="animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div
        className={`w-full h-full p-4 ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
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
      className={`w-full h-full flex flex-col overflow-hidden ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-sm text-neutral-500 truncate">
          {formatLocation(location.city, location.state)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className={`p-1 rounded shrink-0 ${dark ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-200/50'}`}
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`p-1 rounded shrink-0 ${dark ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-200/50'}`}
            title="Change location"
          >
            <Settings size={14} />
          </button>
        </div>
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
        className={`flex-1 min-h-0 px-2 pb-2 ${isVertical ? 'flex flex-col' : 'flex gap-1 overflow-x-auto'}`}
      >
        {(weather.periods || []).map((period, i) => (
          <button
            key={i}
            onClick={() => setSelectedPeriod(period)}
            className={`flex items-center gap-2 rounded-lg hover:bg-neutral-800/50 transition-colors text-left ${
              isVertical ? 'w-full flex-1 min-h-0 px-2' : 'flex-col min-w-[80px] flex-shrink-0 p-2'
            }`}
          >
            <div
              className={`text-neutral-400 ${isVertical ? 'w-20 shrink-0 text-sm' : 'text-center text-xs'}`}
            >
              {period.name}
            </div>
            <img
              src={period.icon}
              alt={period.shortForecast}
              className={`${isVertical ? 'w-10 h-10' : 'w-10 h-10'} rounded shrink-0`}
            />
            <div
              className={`font-medium ${period.isDaytime ? 'text-orange-400' : 'text-blue-400'} ${isVertical ? 'text-lg' : 'text-center'}`}
            >
              {period.temperature}°{period.temperatureUnit}
            </div>
            {isVertical && (
              <div className="text-sm text-neutral-500 truncate flex-1">{period.shortForecast}</div>
            )}
          </button>
        ))}
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
