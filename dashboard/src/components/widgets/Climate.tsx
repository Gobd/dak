import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import type { PanelConfig } from '../../types';

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

const TREND_ICON = { rising: '↑', falling: '↓', steady: '→' } as const;

export default function Climate({ panel, dark }: { panel: PanelConfig; dark: boolean }) {
  const relayUrl = getRelayUrl();
  const updatePanel = useConfigStore((s) => s.updatePanel);
  const [showSettings, setShowSettings] = useState(false);

  const wantCooler = (panel.args?.wantCooler as boolean) ?? true;

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

  const { data, isLoading, error } = useWidgetQuery<ClimateData>(
    ['climate', relayUrl],
    async () => {
      const res = await fetch(`${relayUrl}/sensors/all`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    { refetchInterval: 60_000, enabled: !!relayUrl }
  );

  const sensorsConnected = data
    ? (data.indoor?.available ? 1 : 0) + (data.outdoor?.available ? 1 : 0)
    : 0;

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

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center px-3 py-2 text-sm ${
        dark ? 'bg-black text-white' : 'bg-white text-neutral-900'
      }`}
    >
      {/* Row 1: Sensors + Settings */}
      <div className="flex items-center gap-3 w-full justify-center">
        {!relayUrl ? (
          <span className="text-neutral-500">Configure relay</span>
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
          {/* Connection Status */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Sensor Status
            </label>
            <div className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              {sensorsConnected === 2 ? (
                <span className="text-green-500">2 sensors connected</span>
              ) : sensorsConnected === 1 ? (
                <span className="text-yellow-500">
                  1 sensor connected ({data?.indoor?.available ? 'indoor' : 'outdoor'} only)
                </span>
              ) : (
                <span className="text-red-500">No sensors connected</span>
              )}
            </div>
          </div>

          {/* Season Mode */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Season Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updatePanel(panel.id, { ...panel, args: { ...panel.args, wantCooler: true } });
                }}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  wantCooler
                    ? 'bg-orange-600 text-white'
                    : dark
                      ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                      : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                }`}
              >
                ☀️ Cooling
              </button>
              <button
                onClick={() => {
                  updatePanel(panel.id, { ...panel, args: { ...panel.args, wantCooler: false } });
                }}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  !wantCooler
                    ? 'bg-blue-600 text-white'
                    : dark
                      ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                      : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                }`}
              >
                ❄️ Heating
              </button>
            </div>
            <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
              {wantCooler
                ? 'Recommends opening windows when outside is cooler'
                : 'Recommends opening windows when outside is warmer'}
            </p>
          </div>

          {/* Zigbee2MQTT Link */}
          {zigbeeUrl && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Sensor Management
              </label>
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
                Pair sensors, rename devices, check signal strength
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
