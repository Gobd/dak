import { BatteryFull, BatteryMedium, BatteryWarning, Settings } from 'lucide-react';
import { useToggle } from '@dak/hooks';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import { Modal, Button, Spinner, Toggle } from '@dak/ui';
import { client, allSensorsSensorsAllGet, type AllSensorsResponse } from '@dak/api-client';
import type { WidgetComponentProps } from './index';

const TREND_ICON = { rising: '↑', falling: '↓', steady: '→' } as const;

function getBatteryColor(pct: number): string {
  if (pct < 20) return 'text-danger';
  if (pct < 40) return 'text-warning';
  return 'text-success';
}

function getBatteryIcon(pct: number) {
  if (pct < 20) return BatteryWarning;
  if (pct < 40) return BatteryMedium;
  return BatteryFull;
}

type OutdoorSensor = AllSensorsResponse['outdoor'];

function useOutdoorBattery() {
  const relayUrl = getRelayUrl();

  const { data, isLoading } = useWidgetQuery<AllSensorsResponse>(
    ['climate', relayUrl],
    async () => {
      client.setConfig({ baseUrl: getRelayUrl() });
      const result = await allSensorsSensorsAllGet({ throwOnError: true });
      return result.data;
    },
    { refresh: '5m', enabled: !!relayUrl },
  );

  const outdoor: OutdoorSensor | undefined = data?.outdoor;
  const sensor = outdoor?.available && outdoor.battery_pct != null ? outdoor : undefined;

  return { sensor, isLoading };
}

function DetailModal({
  sensor,
  isLoading,
  showModal,
  panelId,
  currentMode,
}: {
  sensor?: OutdoorSensor & { available: true };
  isLoading: boolean;
  showModal: { value: boolean; setTrue: () => void; setFalse: () => void };
  panelId: string;
  currentMode: 'icon' | 'inline';
}) {
  const updatePanel = useConfigStore((s) => s.updatePanel);

  return (
    <Modal
      open={showModal.value}
      onClose={() => showModal.setFalse()}
      title="Battery Status"
      actions={<Button onClick={() => showModal.setFalse()}>Close</Button>}
    >
      {sensor && sensor.battery_pct != null ? (
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Charge</span>
            <span className={getBatteryColor(sensor.battery_pct)}>
              {sensor.battery_pct.toFixed(0)}%
              {sensor.battery_trend && (
                <span className="ml-1 text-text-muted">{TREND_ICON[sensor.battery_trend]}</span>
              )}
            </span>
          </div>
          {sensor.battery_voltage != null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Voltage</span>
              <span className="text-text">{sensor.battery_voltage.toFixed(2)}V</span>
            </div>
          )}
          {sensor.battery_current_ma != null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Status</span>
              <span className={sensor.battery_current_ma >= 0 ? 'text-success' : 'text-text'}>
                {sensor.battery_current_ma >= 0 ? 'Charging' : 'Discharging'} (
                {Math.abs(sensor.battery_current_ma).toFixed(0)}mA)
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Last updated</span>
            <span className="text-text">{Math.round(sensor.age_seconds / 60)}m ago</span>
          </div>
          <div className="pt-3 border-t border-border">
            <Toggle
              label="Show inline on dashboard"
              checked={currentMode === 'inline'}
              onChange={(checked) =>
                updatePanel(panelId, { args: { mode: checked ? 'inline' : 'icon' } })
              }
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-text-muted">
          {isLoading ? 'Loading...' : 'Outdoor sensor offline'}
        </div>
      )}
    </Modal>
  );
}

function IconMode({
  sensor,
  isLoading,
  showModal,
  panelId,
  currentMode,
}: {
  sensor?: OutdoorSensor & { available: true };
  isLoading: boolean;
  showModal: { value: boolean; setTrue: () => void; setFalse: () => void };
  panelId: string;
  currentMode: 'icon' | 'inline';
}) {
  const pct = sensor?.battery_pct;
  const Icon = pct != null ? getBatteryIcon(pct) : BatteryFull;

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => showModal.setTrue()}
        title="Battery Status"
        className="relative"
      >
        <Icon size={24} className={pct != null ? getBatteryColor(pct) : 'text-text-muted'} />
        {isLoading && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
      </Button>

      <DetailModal
        sensor={sensor}
        isLoading={isLoading}
        showModal={showModal}
        panelId={panelId}
        currentMode={currentMode}
      />
    </div>
  );
}

function InlineMode({
  sensor,
  isLoading,
  showModal,
  panelId,
  currentMode,
}: {
  sensor?: OutdoorSensor & { available: true };
  isLoading: boolean;
  showModal: { value: boolean; setTrue: () => void; setFalse: () => void };
  panelId: string;
  currentMode: 'icon' | 'inline';
}) {
  if (isLoading && !sensor) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!sensor || sensor.battery_pct == null) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
        Offline
      </div>
    );
  }

  const Icon = getBatteryIcon(sensor.battery_pct);
  const settingsButton = (
    <button
      onClick={() => showModal.setTrue()}
      className="p-0.5 rounded text-text-muted hover:text-text transition-colors"
      title="Settings"
    >
      <Settings size={12} />
    </button>
  );

  return (
    <div className="w-full h-full p-3 flex flex-col justify-center gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary flex items-center gap-1">
          <Icon size={14} className={getBatteryColor(sensor.battery_pct)} />
          Battery
          {settingsButton}
        </span>
        <span className="text-text">
          {sensor.battery_pct.toFixed(0)}%
          {sensor.battery_trend && (
            <span className="ml-1 text-text-muted">{TREND_ICON[sensor.battery_trend]}</span>
          )}
        </span>
      </div>
      {sensor.battery_voltage != null && (
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Voltage</span>
          <span className="text-text">{sensor.battery_voltage.toFixed(2)}V</span>
        </div>
      )}
      {sensor.battery_current_ma != null && (
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Status</span>
          <span className={sensor.battery_current_ma >= 0 ? 'text-success' : 'text-text'}>
            {sensor.battery_current_ma >= 0 ? 'Charging' : 'Discharging'}
          </span>
        </div>
      )}

      <DetailModal
        sensor={sensor}
        isLoading={isLoading}
        showModal={showModal}
        panelId={panelId}
        currentMode={currentMode}
      />
    </div>
  );
}

export default function BatteryStatus({ panel }: WidgetComponentProps) {
  const mode = (panel.args?.mode as 'icon' | 'inline') ?? 'icon';
  const showModal = useToggle(false);
  const { sensor, isLoading } = useOutdoorBattery();

  if (mode === 'inline') {
    return (
      <InlineMode
        sensor={sensor}
        isLoading={isLoading}
        showModal={showModal}
        panelId={panel.id}
        currentMode={mode}
      />
    );
  }

  return (
    <IconMode
      sensor={sensor}
      isLoading={isLoading}
      showModal={showModal}
      panelId={panel.id}
      currentMode={mode}
    />
  );
}
