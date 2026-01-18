import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Power, RefreshCw, AlertCircle } from 'lucide-react';
import { getRelayUrl } from '../../stores/config-store';
import { Modal, Button } from '../shared/Modal';
import type { WidgetComponentProps } from './index';
import { parseDuration } from '../../types';

interface KasaDevice {
  ip: string;
  name: string;
  on: boolean;
  model: string;
  type: string;
}

async function discoverDevices(): Promise<KasaDevice[]> {
  try {
    const res = await fetch(`${getRelayUrl()}/kasa/discover`, {
      method: 'POST',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function toggleDevice(ip: string): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/kasa/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    return res.ok;
  } catch {
    return false;
  }
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

async function fetchKasaDevices(): Promise<{ devices: KasaDevice[]; error: string | null }> {
  const relayUp = await checkRelayHealth();
  if (!relayUp) {
    return { devices: [], error: 'Relay offline' };
  }

  const found = await discoverDevices();
  if (found.length === 0) {
    return { devices: [], error: 'No devices found' };
  }
  return { devices: found, error: null };
}

export default function Kasa({ panel, dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Use different refresh intervals based on modal state
  const normalInterval = parseDuration(panel.refresh) ?? undefined;
  const modalInterval = 10000; // 10 seconds when modal is open

  const { data, isLoading } = useQuery({
    queryKey: ['kasa-devices'],
    queryFn: fetchKasaDevices,
    refetchInterval: showModal ? modalInterval : normalInterval,
    staleTime: 5000,
  });

  const devices = [...(data?.devices ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const error = data?.error ?? null;

  async function handleToggle(device: KasaDevice) {
    // Optimistic update
    queryClient.setQueryData(
      ['kasa-devices'],
      (old: { devices: KasaDevice[]; error: string | null } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((d) => (d.ip === device.ip ? { ...d, on: !d.on } : d)),
        };
      }
    );

    const success = await toggleDevice(device.ip);
    if (!success) {
      // Revert on failure
      queryClient.setQueryData(
        ['kasa-devices'],
        (old: { devices: KasaDevice[]; error: string | null } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            devices: old.devices.map((d) => (d.ip === device.ip ? { ...d, on: device.on } : d)),
          };
        }
      );
    }
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['kasa-devices'] });
  }

  // Status indicator
  const anyOn = devices.some((d) => d.on);
  const hasError = !!error;

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Compact icon button */}
      <button
        onClick={() => setShowModal(true)}
        className="relative p-2 hover:bg-neutral-700/30 rounded-lg transition-colors"
        title={`Smart Devices${devices.length > 0 ? ` (${devices.length})` : ''}`}
      >
        <Power size={24} className={anyOn ? 'text-green-400' : 'text-neutral-500'} />
        {hasError && <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-red-500" />}
        {isLoading && (
          <RefreshCw size={10} className="absolute top-0.5 right-0.5 text-blue-400 animate-spin" />
        )}
        {!hasError && !isLoading && devices.length > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[9px] bg-neutral-600 px-1 rounded">
            {devices.length}
          </span>
        )}
      </button>

      {/* Main Modal - Device List */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Smart Devices"
        actions={
          <>
            <Button onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={() => setShowModal(false)} variant="primary">
              Close
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <div className="p-2 bg-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
              {error === 'Relay offline' && (
                <span className="text-neutral-500 text-xs ml-2">Is home-relay running?</span>
              )}
            </div>
          )}

          {devices.length === 0 && !error && !isLoading && (
            <p className="text-neutral-500 text-center py-4">No smart devices discovered.</p>
          )}

          {devices.length > 0 && (
            <div className="space-y-2">
              {devices.map((device) => (
                <button
                  key={device.ip}
                  onClick={() => handleToggle(device)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors
                             ${device.on ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-neutral-700/30 hover:bg-neutral-700/50'}`}
                >
                  <span className="font-medium truncate">{device.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${device.on ? 'bg-green-500/30 text-green-400' : 'bg-neutral-600 text-neutral-400'}`}
                    >
                      {device.on ? 'On' : 'Off'}
                    </span>
                    <Power
                      size={18}
                      className={device.on ? 'text-green-400' : 'text-neutral-500'}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Discovering devices...
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
