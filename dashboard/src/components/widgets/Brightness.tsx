import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, RefreshCw, AlertCircle, Settings, MapPin } from 'lucide-react';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { Modal, Button } from '../shared/Modal';
import { AddressAutocomplete } from '../shared/AddressAutocomplete';
import type { WidgetComponentProps } from './index';
import type { BrightnessConfig } from '../../types';
import { parseDuration } from '../../types';

interface SunTimes {
  date: string | null;
  sunrise: number | null;
  sunset: number | null;
  error?: string;
}

interface BrightnessStatus {
  config: BrightnessConfig;
  current: number | null;
  sun: SunTimes;
}


async function checkRelayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchStatus(): Promise<BrightnessStatus | null> {
  try {
    const res = await fetch(`${getRelayUrl()}/brightness/status`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function setBrightness(level: number): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/brightness/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function geocodeLocation(query: string): Promise<GeocodingResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'User-Agent': 'Dashboard' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      display_name: r.display_name,
    }));
  } catch {
    return [];
  }
}

async function fetchBrightnessData(): Promise<{ status: BrightnessStatus | null; error: string | null }> {
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

export default function Brightness({ panel, dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualBrightness, setManualBrightness] = useState<number | null>(null);

  // Get config from zustand store
  const config = useConfigStore((s) => s.brightness);
  const updateBrightness = useConfigStore((s) => s.updateBrightness);

  // Settings form state - initialized from config
  const [formEnabled, setFormEnabled] = useState(config?.enabled ?? false);
  const [formDayBrightness, setFormDayBrightness] = useState(config?.dayBrightness ?? 100);
  const [formNightBrightness, setFormNightBrightness] = useState(config?.nightBrightness ?? 1);
  const [formLat, setFormLat] = useState<number | null>(config?.lat ?? null);
  const [formLon, setFormLon] = useState<number | null>(config?.lon ?? null);

  // Location search
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const normalInterval = parseDuration(panel.refresh || '1m') ?? 60000;
  const modalInterval = 10000;

  const { data, isLoading } = useQuery({
    queryKey: ['brightness-status'],
    queryFn: fetchBrightnessData,
    refetchInterval: showModal ? modalInterval : normalInterval,
    staleTime: 5000,
  });

  const status = data?.status ?? null;
  const error = data?.error ?? null;

  // Reset form when opening settings modal
  function openSettings() {
    if (config) {
      setFormEnabled(config.enabled ?? false);
      setFormDayBrightness(config.dayBrightness ?? 100);
      setFormNightBrightness(config.nightBrightness ?? 1);
      setFormLat(config.lat ?? null);
      setFormLon(config.lon ?? null);
    }
    setShowSettings(true);
  }

  async function handleBrightnessChange(value: number) {
    setManualBrightness(value);
    await setBrightness(value);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['brightness-status'] });
    }, 500);
  }

  async function handleLocationSearch() {
    if (!locationQuery.trim()) return;
    setSearchingLocation(true);
    const results = await geocodeLocation(locationQuery);
    setLocationResults(results);
    setSearchingLocation(false);
  }

  function handleSelectLocation(result: GeocodingResult) {
    setFormLat(result.lat);
    setFormLon(result.lon);
    setLocationQuery(result.display_name.split(',')[0]);
    setLocationResults([]);
  }

  function handleSaveSettings() {
    updateBrightness({
      enabled: formEnabled,
      dayBrightness: formDayBrightness,
      nightBrightness: formNightBrightness,
      lat: formLat ?? undefined,
      lon: formLon ?? undefined,
    });
    setShowSettings(false);
  }

  // Calculate if it's day based on sun times
  const sunrise = status?.sun?.sunrise ?? 0;
  const sunset = status?.sun?.sunset ?? 0;
  const [now] = useState(() => Date.now() / 1000);
  const isDay = sunrise && sunset ? now >= sunrise && now < sunset : true;

  const hasError = !!error;
  const currentBrightness = manualBrightness ?? status?.current ?? 100;

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-900'}`}
    >
      <button
        onClick={() => setShowModal(true)}
        className="relative p-2 hover:bg-neutral-700/30 rounded-lg transition-colors"
        title={`Brightness: ${currentBrightness}%`}
      >
        {isDay ? (
          <Sun size={24} className={hasError ? 'text-neutral-500' : 'text-yellow-400'} />
        ) : (
          <Moon size={24} className={hasError ? 'text-neutral-500' : 'text-blue-300'} />
        )}
        {hasError && <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-red-500" />}
        {isLoading && (
          <RefreshCw size={10} className="absolute top-0.5 right-0.5 text-blue-400 animate-spin" />
        )}
      </button>

      {/* Main Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Display Brightness"
        actions={
          <>
            <Button onClick={openSettings}>
              <Settings size={14} className="mr-1" /> Settings
            </Button>
            <Button onClick={() => setShowModal(false)} variant="primary">
              Close
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-2 bg-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
              {error === 'Relay offline' && (
                <span className="text-neutral-500 text-xs ml-2">Is home-relay running?</span>
              )}
            </div>
          )}

          {!error && (
            <>
              {/* Current state */}
              <div className="flex items-center gap-4">
                {isDay ? (
                  <Sun size={40} className="text-yellow-400" />
                ) : (
                  <Moon size={40} className="text-blue-300" />
                )}
                <div>
                  <div className="text-4xl font-light">{currentBrightness}%</div>
                  <div className="text-sm text-neutral-500">
                    {config?.enabled ? (isDay ? 'Day mode (auto)' : 'Night mode (auto)') : 'Manual'}
                  </div>
                </div>
              </div>

              {/* Manual brightness slider */}
              <div>
                <label className="block text-sm text-neutral-500 mb-2">Set Brightness</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={currentBrightness}
                  onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer
                             bg-neutral-600
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-5
                             [&::-webkit-slider-thumb]:h-5
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-white
                             [&::-webkit-slider-thumb]:shadow-md"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>1%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Config summary */}
              {config && (
                <div className="pt-3 border-t border-neutral-700 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Auto-adjust</span>
                    <span className={config.enabled ? 'text-green-400' : 'text-neutral-400'}>
                      {config.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {config.enabled && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Day / Night</span>
                        <span>{config.dayBrightness ?? 100}% / {config.nightBrightness ?? 1}%</span>
                      </div>
                      {config.lat && config.lon ? (
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Location</span>
                          <span>{config.lat.toFixed(2)}, {config.lon.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="text-yellow-500 text-xs">
                          Set location in settings for sunrise/sunset
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Loading...
            </div>
          )}
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Brightness Settings"
        actions={
          <>
            <Button onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} variant="primary">
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm">Auto-adjust brightness</label>
            <button
              onClick={() => setFormEnabled(!formEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${formEnabled ? 'bg-green-500' : 'bg-neutral-600'}`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${formEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}
              />
            </button>
          </div>

          {formEnabled && (
            <>
              {/* Location */}
              <div>
                <label className="block text-sm text-neutral-500 mb-1">
                  <MapPin size={14} className="inline mr-1" />
                  Location (for sunrise/sunset)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                    placeholder="Search city..."
                    className="flex-1 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600"
                  />
                  <button
                    onClick={handleLocationSearch}
                    disabled={searchingLocation}
                    className="px-3 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    {searchingLocation ? '...' : 'Search'}
                  </button>
                </div>
                {locationResults.length > 0 && (
                  <div className="mt-2 bg-neutral-800 rounded-lg border border-neutral-600 max-h-40 overflow-y-auto">
                    {locationResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectLocation(r)}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-700 text-sm truncate"
                      >
                        {r.display_name}
                      </button>
                    ))}
                  </div>
                )}
                {formLat && formLon && (
                  <div className="mt-2 text-xs text-green-400">
                    Selected: {formLat.toFixed(4)}, {formLon.toFixed(4)}
                  </div>
                )}
              </div>

              {/* Day brightness */}
              <div>
                <label className="block text-sm text-neutral-500 mb-1">
                  Day Brightness: {formDayBrightness}%
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={formDayBrightness}
                  onChange={(e) => setFormDayBrightness(parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-600
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:h-4
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-yellow-400"
                />
              </div>

              {/* Night brightness */}
              <div>
                <label className="block text-sm text-neutral-500 mb-1">
                  Night Brightness: {formNightBrightness}%
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={formNightBrightness}
                  onChange={(e) => setFormNightBrightness(parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-600
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:h-4
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-blue-400"
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
