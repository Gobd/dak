import { useState, useEffect, useCallback, useRef } from 'react';
import { Power, RefreshCw, AlertCircle } from 'lucide-react';
import { getRelayUrl } from '../../stores/config-store';
import { useRefreshInterval } from '../../hooks/useRefreshInterval';
import { Modal, Button } from '../shared/Modal';
import type { WidgetComponentProps } from './index';

interface KasaDevice {
  alias: string;
  deviceId: string;
  state: boolean;
  host: string;
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

async function toggleDevice(host: string, state: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/kasa/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, state: !state }),
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

export default function Kasa({ panel, dark }: WidgetComponentProps) {
  const [devices, setDevices] = useState<KasaDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);

    // First check if relay is reachable
    const relayUp = await checkRelayHealth();
    if (!relayUp) {
      setError('Relay offline');
      setLoading(false);
      return;
    }

    const found = await discoverDevices();
    if (found.length === 0) {
      setError('No devices found');
    }
    setDevices(found);
    setLoading(false);
  }, []);

  // Initial load
   
  useEffect(() => {
    loadDevices(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadDevices]);

  // Auto-refresh when modal not open
  useRefreshInterval(showModal ? () => {} : loadDevices, panel.refresh);

  // Poll while modal is open
  useEffect(() => {
    if (showModal) {
      loadDevices(); // eslint-disable-line react-hooks/set-state-in-effect
      pollRef.current = setInterval(loadDevices, 10000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [showModal, loadDevices]);

  async function handleToggle(device: KasaDevice) {
    // Optimistic update
    setDevices((prev) =>
      prev.map((d) => (d.deviceId === device.deviceId ? { ...d, state: !d.state } : d))
    );

    const success = await toggleDevice(device.host, device.state);
    if (!success) {
      // Revert on failure
      setDevices((prev) =>
        prev.map((d) => (d.deviceId === device.deviceId ? { ...d, state: device.state } : d))
      );
    }
  }

  // Status indicator
  const anyOn = devices.some((d) => d.state);
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
        {hasError && (
          <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-red-500" />
        )}
        {loading && (
          <RefreshCw size={10} className="absolute top-0.5 right-0.5 text-blue-400 animate-spin" />
        )}
        {!hasError && !loading && devices.length > 0 && (
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
            <Button onClick={loadDevices} disabled={loading}>
              <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
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

          {devices.length === 0 && !error && !loading && (
            <p className="text-neutral-500 text-center py-4">
              No smart devices discovered.
            </p>
          )}

          {devices.length > 0 && (
            <div className="space-y-2">
              {devices.map((device) => (
                <button
                  key={device.deviceId}
                  onClick={() => handleToggle(device)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors
                             ${device.state ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-neutral-700/30 hover:bg-neutral-700/50'}`}
                >
                  <span className="font-medium truncate">{device.alias}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${device.state ? 'bg-green-500/30 text-green-400' : 'bg-neutral-600 text-neutral-400'}`}>
                      {device.state ? 'On' : 'Off'}
                    </span>
                    <Power size={18} className={device.state ? 'text-green-400' : 'text-neutral-500'} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Discovering devices...
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
