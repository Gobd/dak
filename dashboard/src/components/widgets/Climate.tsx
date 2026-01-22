import { useState } from 'react';
import { Settings, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import type { WidgetComponentProps } from './index';
import type { ClimateConfig } from '../../types';

async function checkRelayHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface SensorData {
  available: boolean;
  temperature: number;
  humidity: number;
  feels_like: number;
  temperature_trend: 'rising' | 'falling' | 'steady';
  humidity_trend: 'rising' | 'falling' | 'steady';
  battery: number;
  error?: string;
}

interface ClimateData {
  indoor: SensorData;
  outdoor: SensorData;
  comparison: {
    outside_feels_cooler: boolean;
    outside_feels_warmer: boolean;
    difference: number;
  } | null;
}

interface DeviceInfo {
  friendly_name: string;
  model: string;
  description: string;
}

interface DevicesResponse {
  devices: DeviceInfo[];
}

const TREND_ICON = { rising: '↑', falling: '↓', steady: '→' } as const;

export default function Climate({ dark }: WidgetComponentProps) {
  const relayUrl = getRelayUrl();
  const [showSettings, setShowSettings] = useState(false);
  const climateConfig = useConfigStore((s) => s.climate);
  const updateClimate = useConfigStore((s) => s.updateClimate);

  // Check relay health
  const { data: relayUp } = useQuery({
    queryKey: ['relay-health', relayUrl],
    queryFn: () => checkRelayHealth(relayUrl!),
    enabled: !!relayUrl,
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  const relayOffline = relayUrl && relayUp === false;

  // Derive Zigbee2MQTT URL from relay URL
  const getZigbeeUrl = () => {
    if (!relayUrl) return null;
    try {
      const url = new URL(relayUrl);
      url.port = '8080';
      return url.toString();
    } catch {
      return null;
    }
  };
  const zigbeeUrl = getZigbeeUrl();

  // Fetch sensor data (skip if relay is offline)
  const { data, isLoading, error } = useWidgetQuery<ClimateData>(
    ['climate', relayUrl],
    async () => {
      const res = await fetch(`${relayUrl}/sensors/all`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    { refresh: '5m', enabled: !!relayUrl && relayUp !== false }
  );

  // Fetch available devices (only when settings open and relay is up)
  const { data: devicesData } = useWidgetQuery<DevicesResponse>(
    ['climate-devices', relayUrl],
    async () => {
      const res = await fetch(`${relayUrl}/sensors/devices`);
      if (!res.ok) throw new Error('Failed to fetch devices');
      return res.json();
    },
    { enabled: !!relayUrl && showSettings && relayUp !== false, staleTime: 10_000 }
  );

  const devices = devicesData?.devices ?? [];

  const sensorsConnected = data
    ? (data.indoor?.available ? 1 : 0) + (data.outdoor?.available ? 1 : 0)
    : 0;

  // Save sensor config via config store
  const saveSensorConfig = (updates: Partial<ClimateConfig>) => {
    updateClimate(updates);
  };

  // Get recommendation
  const getRecommendation = () => {
    if (!data?.comparison) return null;
    const { outside_feels_cooler, outside_feels_warmer, difference } = data.comparison;
    const absDiff = Math.abs(difference);

    if (!outside_feels_cooler && !outside_feels_warmer) {
      return { icon: '=', text: 'About the same' };
    }

    if (outside_feels_cooler) {
      return { icon: '❄️', text: `Outside ${absDiff}° cooler` };
    } else {
      return { icon: '🔥', text: `Outside ${absDiff}° warmer` };
    }
  };

  const recommendation = getRecommendation();

  // Compact sensor display
  const renderSensor = (icon: string, sensor: SensorData | undefined) => {
    if (!sensor?.available) {
      return <span className="text-neutral-500">{icon} --</span>;
    }
    const tTemp = TREND_ICON[sensor.temperature_trend];
    const tHum = TREND_ICON[sensor.humidity_trend];
    return (
      <span>
        {icon} {Math.round(sensor.temperature)}°{tTemp} {Math.round(sensor.humidity)}%{tHum}
      </span>
    );
  };

  // Sensor dropdown
  const renderSensorSelect = (role: 'indoor' | 'outdoor', label: string) => {
    const otherRole = role === 'indoor' ? 'outdoor' : 'indoor';
    const otherSelected = climateConfig?.[otherRole];
    // Filter out the device selected for the other role
    const availableDevices = devices.filter((d) => d.friendly_name !== otherSelected);

    return (
      <div>
        <label
          className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {label}
        </label>
        <select
          value={climateConfig?.[role] || ''}
          onChange={(e) => saveSensorConfig({ [role]: e.target.value })}
          className={`w-full px-3 py-2 rounded text-sm ${
            dark
              ? 'bg-neutral-700 text-neutral-200 border-neutral-600'
              : 'bg-neutral-100 text-neutral-800 border-neutral-300'
          } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        >
          <option value="">Not configured</option>
          {availableDevices.map((device) => (
            <option key={device.friendly_name} value={device.friendly_name}>
              {device.friendly_name} ({device.model})
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center px-3 py-2 text-sm ${
        dark ? 'text-white' : 'text-neutral-900'
      }`}
    >
      {/* Row 1: Sensors + Settings */}
      <div className="flex items-center gap-3 w-full justify-center">
        {!relayUrl ? (
          <span className="text-neutral-500">Configure relay</span>
        ) : relayOffline ? (
          <span className="text-neutral-500 flex items-center gap-1">
            <AlertCircle size={12} className="text-red-500" /> Relay offline
          </span>
        ) : isLoading ? (
          <span className="text-neutral-500">Loading...</span>
        ) : error ? (
          <span className="text-red-400">Error</span>
        ) : sensorsConnected === 0 ? (
          <span className="text-neutral-500">No sensors</span>
        ) : (
          <>
            {renderSensor('🏠', data?.indoor)}
            {renderSensor('🌳', data?.outdoor)}
          </>
        )}
        <button
          onClick={() => setShowSettings(true)}
          className={`p-1 rounded transition-colors ${
            dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'
          }`}
          title="Settings"
        >
          <Settings size={14} className="text-neutral-400" />
        </button>
      </div>

      {/* Row 2: Recommendation */}
      {recommendation && sensorsConnected === 2 && (
        <div className="text-neutral-400 text-xs mt-1">
          {recommendation.icon} {recommendation.text}
        </div>
      )}

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Climate Settings"
        actions={
          <Button onClick={() => setShowSettings(false)} variant="primary">
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Sensor Selection */}
          {devices.length > 0 ? (
            <>
              {renderSensorSelect('indoor', '🏠 Indoor Sensor')}
              {renderSensorSelect('outdoor', '🌳 Outdoor Sensor')}
            </>
          ) : (
            <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              No climate sensors found. Pair sensors in Zigbee2MQTT first.
            </div>
          )}

          {/* Temperature Unit */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Temperature Unit
            </label>
            <div className="flex gap-2">
              {(['C', 'F'] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => saveSensorConfig({ unit })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    (climateConfig?.unit ?? 'C') === unit
                      ? 'bg-blue-600 text-white'
                      : dark
                        ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                        : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  }`}
                >
                  °{unit}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Status */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Status
            </label>
            <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              {sensorsConnected === 2 ? (
                <span className="text-green-500">✓ Both sensors receiving data</span>
              ) : sensorsConnected === 1 ? (
                <span className="text-yellow-500">
                  ⚠ Only {data?.indoor?.available ? 'indoor' : 'outdoor'} receiving data
                </span>
              ) : climateConfig?.indoor || climateConfig?.outdoor ? (
                <span className="text-yellow-500">⚠ Waiting for sensor data...</span>
              ) : (
                <span className="text-neutral-500">Select sensors above</span>
              )}
            </div>
          </div>

          {/* Zigbee2MQTT Link */}
          {zigbeeUrl && (
            <div>
              <a
                href={zigbeeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full px-3 py-2 rounded transition-colors text-sm text-center ${
                  dark
                    ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                }`}
              >
                Open Zigbee2MQTT UI
              </a>
              <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
                Pair new sensors, rename devices, check signal
              </p>
            </div>
          )}

          {/* Battery warnings */}
          {data?.indoor?.available && data.indoor.battery < 20 && (
            <div className="text-yellow-500 text-sm">
              ⚠️ Indoor sensor battery low ({data.indoor.battery}%)
            </div>
          )}
          {data?.outdoor?.available && data.outdoor.battery < 20 && (
            <div className="text-yellow-500 text-sm">
              ⚠️ Outdoor sensor battery low ({data.outdoor.battery}%)
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
