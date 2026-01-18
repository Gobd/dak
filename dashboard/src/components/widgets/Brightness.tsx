import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, RefreshCw, AlertCircle } from 'lucide-react';
import { getRelayUrl } from '../../stores/config-store';
import { Modal, Button } from '../shared/Modal';
import type { WidgetComponentProps } from './index';
import { parseDuration } from '../../types';

interface BrightnessConfig {
  enabled: boolean;
  minBrightness: number;
  maxBrightness: number;
  sunriseOffset: number;
  sunsetOffset: number;
}

interface BrightnessStatus {
  currentBrightness: number;
  targetBrightness: number;
  isDay: boolean;
  nextChange: string;
}

interface BrightnessData {
  config: BrightnessConfig | null;
  status: BrightnessStatus | null;
  error: string | null;
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

async function fetchConfig(): Promise<BrightnessConfig | null> {
  try {
    const res = await fetch(`${getRelayUrl()}/config/brightness`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
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

async function setBrightness(brightness: number): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/brightness/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brightness }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchBrightnessData(): Promise<BrightnessData> {
  const relayUp = await checkRelayHealth();
  if (!relayUp) {
    return { config: null, status: null, error: 'Relay offline' };
  }

  const [cfg, sts] = await Promise.all([fetchConfig(), fetchStatus()]);

  if (!cfg && !sts) {
    return { config: null, status: null, error: 'Could not load brightness data' };
  }

  return { config: cfg, status: sts, error: null };
}

export default function Brightness({ panel, dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [manualBrightness, setManualBrightness] = useState<number | null>(null);

  // Use different refresh intervals based on modal state
  const normalInterval = parseDuration(panel.refresh || '1m') ?? 60000;
  const modalInterval = 10000; // 10 seconds when modal is open

  const { data, isLoading } = useQuery({
    queryKey: ['brightness-data'],
    queryFn: fetchBrightnessData,
    refetchInterval: showModal ? modalInterval : normalInterval,
    staleTime: 5000,
  });

  const config = data?.config ?? null;
  const status = data?.status ?? null;
  const error = data?.error ?? null;

  async function handleBrightnessChange(value: number) {
    setManualBrightness(value);
    await setBrightness(value);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['brightness-data'] });
    }, 500);
  }

  // Status indicators
  const hasError = !!error;
  const isDay = status?.isDay ?? true;
  const currentBrightness = manualBrightness ?? status?.currentBrightness ?? 100;

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Compact icon button */}
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
          <Button onClick={() => setShowModal(false)} variant="primary">
            Close
          </Button>
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
                    {isDay ? 'Day mode' : 'Night mode'}
                  </div>
                </div>
              </div>

              {/* Slider */}
              <div>
                <input
                  type="range"
                  min={0}
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
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Next change */}
              {status?.nextChange && (
                <div className="text-sm text-neutral-500">
                  Next auto-change: {status.nextChange}
                </div>
              )}

              {/* Config info */}
              {config && (
                <div className="pt-3 border-t border-neutral-700 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Auto-adjust</span>
                    <span>{config.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Day brightness</span>
                    <span>{config.maxBrightness}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Night brightness</span>
                    <span>{config.minBrightness}%</span>
                  </div>
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
    </div>
  );
}
