import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, RefreshCw, AlertTriangle, Wind } from 'lucide-react';
import { useLocation, formatLocation } from '../../hooks/useLocation';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { AddressAutocomplete } from '../shared/AddressAutocomplete';
import { Modal, Button, Spinner } from '@dak/ui';
import type { WidgetComponentProps } from './index';
import type { LocationConfig } from '../../types';

// Simple hash for alert content change detection
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 6);
}

// Register weather alerts as notifications via postMessage
function registerWeatherAlerts(alerts: NwsAlert[]) {
  const today = new Date().toISOString().split('T')[0];

  for (const alert of alerts) {
    // Hash content so updates (12in→2ft, timing changes) trigger new notification
    const contentHash = simpleHash(
      (alert.properties.headline || '') + (alert.properties.description || ''),
    );

    const payload = {
      type: 'weather',
      name: `${alert.properties.event} #${contentHash}`,
      due: today, // Show immediately
      data: {
        severity: alert.properties.severity,
        headline: alert.properties.headline,
        expires: new Date(alert.properties.expires).toLocaleString(),
      },
    };

    // Use postMessage - dashboard's notification listener will handle it
    window.postMessage({ action: 'notify', payload }, '*');
  }
}

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
      return 'bg-danger';
    case 'severe':
      return 'bg-warning';
    case 'moderate':
      return 'bg-warning';
    default:
      return 'bg-accent';
  }
}

interface WeatherSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (location: LocationConfig) => void;
  onRefresh: () => void;
  currentLocation?: LocationConfig | null;
  isRefreshing?: boolean;
}

function WeatherSettingsModal({
  open,
  onClose,
  onSave,
  onRefresh,
  currentLocation,
  isRefreshing,
}: WeatherSettingsModalProps) {
  const [query, setQuery] = useState(currentLocation?.query ?? '');
  const [pendingLocation, setPendingLocation] = useState<{
    lat?: number;
    lon?: number;
    address: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(details: { address: string; lat?: number; lon?: number }) {
    setPendingLocation(details);
    setError(null);
  }

  function handleSave() {
    if (!pendingLocation?.lat || !pendingLocation?.lon) {
      setError('Please select a location from the suggestions.');
      return;
    }

    const parts = pendingLocation.address.split(', ');
    let city = parts[0];
    let state = '';

    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].trim();
      const stateMatch = part.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
      if (stateMatch) {
        state = stateMatch[1];
        if (i > 0) city = parts[i - 1].trim();
        break;
      }
    }

    onSave({
      lat: pendingLocation.lat,
      lon: pendingLocation.lon,
      city,
      state,
      query: pendingLocation.address,
    });
    onClose();
  }

  const currentDisplay = currentLocation
    ? formatLocation(currentLocation.city, currentLocation.state)
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Weather Settings"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} variant="primary">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Refresh */}
        <div>
          <label className="block text-sm font-medium mb-2">Data</label>
          <Button onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <RefreshCw size={14} className="mr-2" />
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </Button>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium mb-2">Location</label>
          <AddressAutocomplete
            value={query}
            onChange={setQuery}
            onSelect={handleSelect}
            placeholder="e.g., San Francisco, CA"
            className="bg-surface-sunken border-border text-text"
          />
          {currentDisplay && (
            <p className="text-sm text-text-muted mt-2">Current: {currentDisplay}</p>
          )}
          {pendingLocation && (
            <p className="text-sm text-success mt-1">Selected: {pendingLocation.address}</p>
          )}
          {error && <p className="text-sm text-danger mt-1">{error}</p>}
        </div>
      </div>
    </Modal>
  );
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

export default function Weather({ panel }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const widgetId = panel.id || 'weather';
  const layout = (panel.args?.layout as string) || 'horizontal';
  const { location, setLocation } = useLocation(
    widgetId,
    panel.args?.lat as number | undefined,
    panel.args?.lon as number | undefined,
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
    },
  );

  // Register severe weather alerts as notifications
  useEffect(() => {
    if (weather?.alerts && weather.alerts.length > 0) {
      // Only register moderate/severe/extreme alerts
      const severeAlerts = weather.alerts.filter((a) =>
        ['moderate', 'severe', 'extreme'].includes(a.properties.severity?.toLowerCase()),
      );
      if (severeAlerts.length > 0) {
        registerWeatherAlerts(severeAlerts);
      }
    }
  }, [weather?.alerts]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['weather', location?.lat, location?.lon] });
  };

  if (isLoading && !weather) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-surface text-text`}>
        <Spinner size="md" />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className={`w-full h-full p-4 bg-surface text-text`}>
        <p className="text-danger text-sm mb-2">{error.message}</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!weather) return null;

  const isVertical = layout === 'vertical';

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden bg-surface text-text`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-sm text-text-muted truncate">
          {formatLocation(location.city, location.state)}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowSettings(true)}
          className="shrink-0 opacity-70 hover:opacity-100"
          title="Settings"
        >
          <Settings size={14} className="text-text-muted" />
        </Button>
      </div>

      {/* Alerts */}
      {weather.alerts && weather.alerts.length > 0 && (
        <div className="px-3 pb-2 space-y-1 shrink-0">
          {weather.alerts.slice(0, 3).map((alert, i) => (
            <Button
              key={i}
              variant="ghost"
              onClick={() => setSelectedAlert(alert)}
              className={`w-full flex items-center gap-2 px-2 py-1 h-auto justify-start text-xs text-text ${getAlertSeverityColor(alert.properties.severity)}`}
            >
              <AlertTriangle size={12} className="shrink-0" />
              <span className="truncate flex-1">{alert.properties.event}</span>
              <span className="shrink-0 opacity-75">
                {formatAlertTime(alert.properties.expires)}
              </span>
            </Button>
          ))}
          {weather.alerts && weather.alerts.length > 3 && (
            <div className="text-xs text-text-muted px-2">
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
          <Button
            key={i}
            variant="ghost"
            onClick={() => setSelectedPeriod(period)}
            className={`flex items-center gap-2 h-auto justify-start ${
              isVertical ? 'w-full flex-1 min-h-0 px-2' : 'flex-col min-w-[80px] flex-shrink-0 p-2'
            }`}
          >
            <div
              className={`text-text-muted ${isVertical ? 'w-20 shrink-0 text-sm' : 'text-center text-xs'}`}
            >
              {period.name}
            </div>
            <img
              src={period.icon}
              alt={period.shortForecast}
              className={`${isVertical ? 'w-10 h-10' : 'w-10 h-10'} rounded shrink-0`}
            />
            <div
              className={`font-medium ${period.isDaytime ? 'text-warning' : 'text-accent'} ${isVertical ? 'text-lg' : 'text-center'}`}
            >
              {period.temperature}°{period.temperatureUnit}
            </div>
            {isVertical && (
              <div className="text-sm text-text-muted truncate flex-1">{period.shortForecast}</div>
            )}
          </Button>
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
                  className={`text-3xl font-bold ${selectedPeriod.isDaytime ? 'text-warning' : 'text-accent'}`}
                >
                  {selectedPeriod.temperature}°{selectedPeriod.temperatureUnit}
                </div>
                <div className="text-text-muted">{selectedPeriod.shortForecast}</div>
              </div>
            </div>

            {selectedPeriod.detailedForecast && (
              <p className="text-sm text-text-secondary">{selectedPeriod.detailedForecast}</p>
            )}

            {selectedPeriod.windSpeed && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
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

            <div className="text-sm text-text-muted">
              <strong>Expires:</strong>{' '}
              {new Date(selectedAlert.properties.expires).toLocaleString()}
              <br />
              <strong>Time remaining:</strong> {formatAlertTime(selectedAlert.properties.expires)}
            </div>

            {selectedAlert.properties.headline && (
              <p className="text-sm font-medium">{selectedAlert.properties.headline}</p>
            )}

            {selectedAlert.properties.description && (
              <p className="text-sm text-text-secondary whitespace-pre-wrap max-h-48 overflow-auto">
                {selectedAlert.properties.description}
              </p>
            )}

            {selectedAlert.properties.instruction && (
              <div className="text-sm">
                <strong>Instructions:</strong>
                <p className="text-text-secondary mt-1">{selectedAlert.properties.instruction}</p>
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <Button onClick={() => setSelectedAlert(null)}>Close</Button>
        </div>
      </Modal>

      {/* Settings Modal */}
      <WeatherSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={setLocation}
        onRefresh={handleRefresh}
        currentLocation={location}
        isRefreshing={isLoading}
      />
    </div>
  );
}
