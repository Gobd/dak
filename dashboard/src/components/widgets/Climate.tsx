import { Settings, AlertCircle, Radio } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToggle } from '@dak/hooks';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import {
  client,
  healthHealthGet,
  allSensorsSensorsAllGet,
  devicesSensorsDevicesGet,
  type AllSensorsResponse,
  type DevicesResponse,
  type SensorReadingResponse,
} from '@dak/api-client';
import type { WidgetComponentProps } from './index';
import type { ClimateConfig } from '../../types';

async function checkRelayHealth(): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    await healthHealthGet({ throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

const TREND_ICON = { rising: '↑', falling: '↓', steady: '→' } as const;

export default function Climate({ dark }: WidgetComponentProps) {
  const relayUrl = getRelayUrl();
  const showSettings = useToggle(false);
  const climateConfig = useConfigStore((s) => s.climate);
  const updateClimate = useConfigStore((s) => s.updateClimate);

  // Check relay health
  const { data: relayUp } = useQuery({
    queryKey: ['relay-health', relayUrl],
    queryFn: checkRelayHealth,
    enabled: !!relayUrl,
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  const relayOffline = relayUrl && relayUp === false;

  // Fetch sensor data (skip if relay is offline)
  const { data, isLoading, error } = useWidgetQuery<AllSensorsResponse>(
    ['climate', relayUrl],
    async () => {
      client.setConfig({ baseUrl: getRelayUrl() });
      const result = await allSensorsSensorsAllGet({ throwOnError: true });
      return result.data;
    },
    { refresh: '5m', enabled: !!relayUrl && relayUp !== false },
  );

  // Fetch available devices (only when settings open and relay is up)
  const { data: devicesData } = useWidgetQuery<DevicesResponse>(
    ['climate-devices', relayUrl],
    async () => {
      client.setConfig({ baseUrl: getRelayUrl() });
      const result = await devicesSensorsDevicesGet({ throwOnError: true });
      return result.data;
    },
    { enabled: !!relayUrl && showSettings.value && relayUp !== false, staleTime: 10_000 },
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

  // Compact sensor display - returns [icon, temp, humidity] for grid alignment
  const renderSensorRow = (icon: string, sensor: AllSensorsResponse['indoor'] | undefined) => {
    if (!sensor?.available) {
      return (
        <div className="contents">
          <span>{icon}</span>
          <span className="text-text-muted">--</span>
          <span className="text-text-muted">--</span>
        </div>
      );
    }
    const s = sensor as SensorReadingResponse;
    const tTemp = TREND_ICON[s.temperature_trend];
    const tHum = TREND_ICON[s.humidity_trend];
    return (
      <div className="contents">
        <span>{icon}</span>
        <span>
          {Math.round(s.temperature)}°{tTemp}
        </span>
        <span className="text-text-muted">
          {Math.round(s.humidity)}%{tHum}
        </span>
      </div>
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
        <label className={`block text-sm font-medium mb-2 text-text-secondary`}>{label}</label>
        <select
          value={climateConfig?.[role] || ''}
          onChange={(e) => saveSensorConfig({ [role]: e.target.value })}
          className={`w-full px-3 py-2 rounded text-sm ${
            dark
              ? 'bg-surface-sunken text-text border-border'
              : 'bg-surface-sunken text-text border-border'
          } border focus:outline-none focus:ring-2 focus:ring-accent`}
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
    <div className="w-full h-full flex flex-col items-center justify-center px-3 py-2 text-sm text-text">
      {/* Sensors display */}
      <div className="flex items-center gap-4">
        {!relayUrl ? (
          <span className="text-text-muted">Configure relay</span>
        ) : relayOffline ? (
          <span className="text-text-muted flex items-center gap-1">
            <AlertCircle size={12} className="text-danger" /> Relay offline
          </span>
        ) : isLoading ? (
          <span className="text-text-muted">Loading...</span>
        ) : error ? (
          <span className="text-danger">Error</span>
        ) : sensorsConnected === 0 ? (
          <span className="text-text-muted">No sensors</span>
        ) : (
          <div className="grid grid-cols-[auto_auto_auto] gap-x-2 gap-y-0.5 items-center">
            {renderSensorRow('🏠', data?.indoor)}
            {renderSensorRow('🌳', data?.outdoor)}
          </div>
        )}
        <button
          onClick={() => showSettings.setTrue()}
          className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-surface-sunken/50 transition-all ml-2"
          title="Settings"
        >
          <Settings size={14} className="text-text-muted" />
        </button>
      </div>

      {/* Row 2: Recommendation */}
      {recommendation && sensorsConnected === 2 && (
        <div className="text-text-muted text-xs mt-1">
          {recommendation.icon} {recommendation.text}
        </div>
      )}

      {/* Settings Modal */}
      <Modal
        open={showSettings.value}
        onClose={() => showSettings.setFalse()}
        title="Climate Settings"
        actions={
          <Button onClick={() => showSettings.setFalse()} variant="primary">
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
            <div className={`text-sm text-text-muted`}>
              No climate sensors found. Pair sensors in Zigbee2MQTT first.
            </div>
          )}

          {/* Temperature Unit */}
          <div>
            <label className={`block text-sm font-medium mb-2 text-text-secondary`}>
              Temperature Unit
            </label>
            <div className="flex gap-2">
              {(['C', 'F'] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => saveSensorConfig({ unit })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    (climateConfig?.unit ?? 'C') === unit
                      ? 'bg-accent text-text'
                      : dark
                        ? 'bg-surface-sunken text-text-secondary hover:bg-border'
                        : 'bg-surface-sunken text-text-secondary hover:bg-surface-sunken'
                  }`}
                >
                  °{unit}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Status */}
          <div>
            <label className={`block text-sm font-medium mb-2 text-text-secondary`}>Status</label>
            <div className={`text-sm text-text-muted`}>
              {sensorsConnected === 2 ? (
                <span className="text-success">✓ Both sensors receiving data</span>
              ) : sensorsConnected === 1 ? (
                <span className="text-warning">
                  ⚠ Only {data?.indoor?.available ? 'indoor' : 'outdoor'} receiving data
                </span>
              ) : climateConfig?.indoor || climateConfig?.outdoor ? (
                <span className="text-warning">⚠ Waiting for sensor data...</span>
              ) : (
                <span className="text-text-muted">Select sensors above</span>
              )}
            </div>
          </div>

          {/* Manage Devices Link */}
          <div>
            <button
              onClick={() => {
                showSettings.setFalse();
                useConfigStore.getState().setMqttModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded transition-colors text-sm bg-surface-sunken text-text-secondary hover:bg-border"
            >
              <Radio size={14} />
              Manage Zigbee Devices
            </button>
            <p className="text-xs mt-1 text-text-muted">
              Pair new sensors, rename or remove devices
            </p>
          </div>

          {/* Battery warnings */}
          {data?.indoor?.available && data.indoor.battery < 20 && (
            <div className="text-warning text-sm">
              ⚠️ Indoor sensor battery low ({data.indoor.battery}%)
            </div>
          )}
          {data?.outdoor?.available && data.outdoor.battery < 20 && (
            <div className="text-warning text-sm">
              ⚠️ Outdoor sensor battery low ({data.outdoor.battery}%)
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
