import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToggle } from '@dak/hooks';
import { Sun, Moon, AlertCircle, MapPin, Clock } from 'lucide-react';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { Modal, Button, NumberPickerCompact, Spinner, Toggle, Slider } from '@dak/ui';
import { AddressAutocomplete } from '../shared/AddressAutocomplete';
import { formatLocation } from '../../hooks/useLocation';
import {
  client,
  healthHealthGet,
  statusBrightnessStatusGet,
  setBrightnessBrightnessSetPost,
  type BrightnessStatus,
} from '@dak/api-client';

async function checkRelayHealth(): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    await healthHealthGet({ throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

async function fetchStatus(): Promise<BrightnessStatus | null> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    const result = await statusBrightnessStatusGet();
    return result.data ?? null;
  } catch {
    return null;
  }
}

async function setBrightness(level: number): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    await setBrightnessBrightnessSetPost({ body: { level }, throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

async function fetchBrightnessData(): Promise<{
  status: BrightnessStatus | null;
  error: string | null;
}> {
  const relayUp = await checkRelayHealth();
  if (!relayUp) {
    return { status: null, error: 'Relay offline' };
  }

  const status = await fetchStatus();
  if (!status) {
    return { status: null, error: 'Could not load brightness data' };
  }

  return { status, error: null };
}

export default function Brightness() {
  const queryClient = useQueryClient();
  const showModal = useToggle(false);
  const [manualBrightness, setManualBrightness] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  // Get config from zustand store
  const config = useConfigStore((s) => s.brightness);
  const globalSettings = useConfigStore((s) => s.globalSettings);
  const updateBrightness = useConfigStore((s) => s.updateBrightness);

  // Use brightness-specific location, or fall back to global default
  const effectiveLocation =
    config?.lat && config?.lon
      ? {
          lat: config.lat,
          lon: config.lon,
          name: config.locationName || formatLocation(config.city, config.state),
        }
      : globalSettings?.defaultLocation
        ? {
            ...globalSettings.defaultLocation,
            name: formatLocation(
              globalSettings.defaultLocation.city,
              globalSettings.defaultLocation.state,
            ),
          }
        : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['brightness-status'],
    queryFn: fetchBrightnessData,
    refetchInterval: showModal.value ? 5_000 : 60_000,
    staleTime: 5000,
  });

  const status = data?.status ?? null;
  const error = data?.error ?? null;

  async function handleBrightnessChange(value: number) {
    setManualBrightness(value);
    await setBrightness(value);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['brightness-status'] });
    }, 500);
  }

  function handleToggleEnabled() {
    const enabling = !config?.enabled;
    if (enabling && !config?.lat && !config?.lon && effectiveLocation) {
      // Copy global default location to brightness config when enabling
      updateBrightness({
        enabled: true,
        lat: effectiveLocation.lat,
        lon: effectiveLocation.lon,
        locationName: effectiveLocation.name,
      });
    } else {
      updateBrightness({ enabled: enabling });
    }
  }

  // Check if we have any location available (brightness-specific or global)
  const hasLocation = !!(config?.lat && config?.lon) || !!effectiveLocation;

  function handleDayBrightnessChange(value: number) {
    updateBrightness({ dayBrightness: value });
  }

  function handleNightBrightnessChange(value: number) {
    updateBrightness({ nightBrightness: value });
  }

  function handleTransitionChange(value: number) {
    updateBrightness({ transitionMins: value });
  }

  function handleLocationSelect(details: {
    address: string;
    lat?: number;
    lon?: number;
    city?: string;
    state?: string;
  }) {
    if (details.lat && details.lon) {
      const locationName =
        formatLocation(details.city, details.state) || details.address.split(',')[0];
      updateBrightness({
        lat: details.lat,
        lon: details.lon,
        city: details.city,
        state: details.state,
        locationName,
      });
      setLocationAddress(locationName);
    }
  }

  // Calculate if it's day based on sun times
  const sunrise = status?.sun?.sunrise ?? 0;
  const sunset = status?.sun?.sunset ?? 0;
  const [now] = useState(() => Date.now() / 1000);
  const isDay = sunrise && sunset ? now >= sunrise && now < sunset : true;

  const hasError = !!error;
  const currentBrightness = manualBrightness ?? status?.current ?? 100;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={showModal.setTrue}
        className="relative"
        title={`Brightness: ${currentBrightness}%`}
      >
        {isDay ? (
          <Sun size={24} className={hasError ? 'text-text-muted' : 'text-warning'} />
        ) : (
          <Moon size={24} className={hasError ? 'text-text-muted' : 'text-accent'} />
        )}
        {hasError && <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-danger" />}
        {isLoading && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
      </Button>

      <Modal
        open={showModal.value}
        onClose={showModal.setFalse}
        title="Display Brightness"
        actions={
          <Button onClick={showModal.setFalse} variant="primary">
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-2 bg-danger/20 rounded text-danger text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
              {error === 'Relay offline' && (
                <span className="text-text-muted text-xs ml-2">Is home-relay running?</span>
              )}
            </div>
          )}

          {!error && (
            <>
              {/* Current state and manual brightness */}
              <div className="flex items-center gap-4">
                {isDay ? (
                  <Sun size={40} className="text-warning" />
                ) : (
                  <Moon size={40} className="text-accent" />
                )}
                <div className="flex-1">
                  <div className="text-3xl font-light">{currentBrightness}%</div>
                  <div className="text-sm text-text-muted">
                    {config?.enabled ? (isDay ? 'Day mode (auto)' : 'Night mode (auto)') : 'Manual'}
                  </div>
                </div>
              </div>

              {/* Set brightness now */}
              <Slider
                label="Set Now"
                min={1}
                max={100}
                value={currentBrightness}
                onChange={handleBrightnessChange}
                showRange
              />

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Auto-adjust toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm">Auto-adjust by sunrise/sunset</label>
                  {!hasLocation && (
                    <div className="text-xs text-text-muted">
                      Set location in Global Settings first
                    </div>
                  )}
                </div>
                <Toggle
                  checked={config?.enabled ?? false}
                  onChange={handleToggleEnabled}
                  disabled={!hasLocation && !config?.enabled}
                />
              </div>

              {config?.enabled && (
                <>
                  {/* Location */}
                  <div>
                    <label className="block text-sm text-text-muted mb-1">
                      <MapPin size={14} className="inline mr-1" />
                      Location
                    </label>
                    <AddressAutocomplete
                      value={locationAddress}
                      onChange={setLocationAddress}
                      onSelect={handleLocationSelect}
                      placeholder={effectiveLocation?.name || 'Search city...'}
                    />
                    {config?.lat && config?.lon ? (
                      <div className="mt-2 text-xs text-success">
                        {config.locationName ||
                          `${config.lat.toFixed(4)}, ${config.lon.toFixed(4)}`}
                      </div>
                    ) : effectiveLocation ? (
                      <div className="mt-2 text-xs text-accent">
                        Using global default:{' '}
                        {effectiveLocation.name ||
                          `${effectiveLocation.lat.toFixed(4)}, ${effectiveLocation.lon.toFixed(4)}`}
                      </div>
                    ) : null}
                  </div>

                  {/* Day brightness */}
                  <div>
                    <label className="block text-sm text-text-muted mb-1">
                      <Sun size={14} className="inline mr-1 text-warning" />
                      Day: {config.dayBrightness ?? 100}%
                    </label>
                    <Slider
                      min={1}
                      max={100}
                      value={config.dayBrightness ?? 100}
                      onChange={handleDayBrightnessChange}
                      thumbColor="warning"
                    />
                  </div>

                  {/* Night brightness */}
                  <div>
                    <label className="block text-sm text-text-muted mb-1">
                      <Moon size={14} className="inline mr-1 text-accent" />
                      Night: {config.nightBrightness ?? 1}%
                    </label>
                    <Slider
                      min={1}
                      max={100}
                      value={config.nightBrightness ?? 1}
                      onChange={handleNightBrightnessChange}
                      thumbColor="accent"
                    />
                  </div>

                  {/* Transition duration */}
                  <div>
                    <label className="block text-sm text-text-muted mb-1">
                      <Clock size={14} className="inline mr-1" />
                      Transition duration
                    </label>
                    <NumberPickerCompact
                      value={config.transitionMins ?? 60}
                      onChange={handleTransitionChange}
                      min={5}
                      max={120}
                      step={5}
                      suffix="min"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Spinner size="sm" /> Loading...
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
