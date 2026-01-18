import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Power, Monitor, Trash2, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { useRefreshInterval } from '../../hooks/useRefreshInterval';
import { Modal, Button } from '../shared/Modal';
import { ConfirmModal } from '../shared/ConfirmModal';
import type { WidgetComponentProps } from './index';

interface WolDevice {
  name: string;
  mac: string;
  ip: string;
}

async function pingDevice(ip: string): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/wol/ping?ip=${encodeURIComponent(ip)}`, {
      method: 'GET',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.alive === true;
  } catch {
    return false;
  }
}

async function wakeDevice(mac: string): Promise<boolean> {
  try {
    const res = await fetch(`${getRelayUrl()}/wol/wake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getMacFromIp(ip: string): Promise<string | null> {
  try {
    const res = await fetch(`${getRelayUrl()}/wol/mac?ip=${encodeURIComponent(ip)}`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.mac || null;
  } catch {
    return null;
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

export default function Wol({ panel, dark }: WidgetComponentProps) {
  const widgetId = panel.id || 'wol';

  // Get devices from config - memoize to prevent unnecessary re-renders
  const config = useConfigStore((s) => s.locations?.[widgetId]) as unknown as
    | { devices?: WolDevice[] }
    | undefined;
  const updateLocation = useConfigStore((s) => s.updateLocation);
  const devices = useMemo(() => config?.devices ?? [], [config?.devices]);

  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [waking, setWaking] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteDevice, setDeleteDevice] = useState<WolDevice | null>(null);
  const [addForm, setAddForm] = useState({ name: '', ip: '', mac: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const saveDevices = useCallback(
    (newDevices: WolDevice[]) => {
      updateLocation(widgetId, { devices: newDevices } as unknown as { lat: number; lon: number });
    },
    [widgetId, updateLocation]
  );

  const checkStatuses = useCallback(async () => {
    setLoading(true);
    setError(null);

    // First check if relay is reachable
    const relayUp = await checkRelayHealth();
    if (!relayUp) {
      setError('Relay offline');
      setLoading(false);
      return;
    }

    if (devices.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const results = await Promise.all(
        devices.map(async (d) => ({
          ip: d.ip,
          online: await pingDevice(d.ip),
        }))
      );

      const newStatuses: Record<string, boolean> = {};
      results.forEach((r) => {
        newStatuses[r.ip] = r.online;
      });
      setStatuses(newStatuses);
    } catch {
      setError('Could not connect');
    }
    setLoading(false);
  }, [devices]);

  // Initial load - use ref to avoid re-triggering on callback changes
  const checkStatusesRef = useRef(checkStatuses);
  useEffect(() => {
    checkStatusesRef.current = checkStatuses;
  });

  useEffect(() => {
    checkStatusesRef.current();
  }, []); // Only run once on mount

  // Auto-refresh when not modal open
  useRefreshInterval(showModal ? () => {} : checkStatuses, panel.refresh);

  // Poll while modal is open
  useEffect(() => {
    if (showModal && devices.length > 0) {
      checkStatusesRef.current();
      pollRef.current = setInterval(() => checkStatusesRef.current(), 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [showModal, devices.length]);

  async function handleWake(device: WolDevice) {
    setWaking(device.mac);
    await wakeDevice(device.mac);
    // Check status after a delay
    setTimeout(async () => {
      const online = await pingDevice(device.ip);
      setStatuses((prev) => ({ ...prev, [device.ip]: online }));
      setWaking(null);
    }, 5000);
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.ip.trim()) {
      setAddError('Name and IP are required');
      return;
    }

    let mac = addForm.mac.trim();
    if (!mac) {
      setAddError('Detecting MAC address...');
      mac = (await getMacFromIp(addForm.ip)) || '';
      if (!mac) {
        setAddError('Could not detect MAC. Enter manually or ensure device is online.');
        return;
      }
    }

    saveDevices([...devices, { name: addForm.name, ip: addForm.ip, mac }]);
    setShowAddModal(false);
    setAddForm({ name: '', ip: '', mac: '' });
    setAddError(null);
  }

  function handleDelete() {
    if (!deleteDevice) return;
    saveDevices(devices.filter((d) => d.mac !== deleteDevice.mac));
    setDeleteDevice(null);
  }

  // Status indicator: green if any online, red if error
  const anyOnline = devices.length > 0 && Object.values(statuses).some((s) => s);
  const hasError = !!error;

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${dark ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Compact icon button */}
      <button
        onClick={() => setShowModal(true)}
        className="relative p-2 hover:bg-neutral-700/30 rounded-lg transition-colors"
        title={`Wake on LAN${devices.length > 0 ? ` (${devices.length} devices)` : ''}`}
      >
        <Monitor size={24} className={anyOnline ? 'text-green-400' : 'text-neutral-500'} />
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
        title="Wake on LAN"
        actions={
          <>
            <Button onClick={() => setShowModal(false)}>Close</Button>
            <Button onClick={() => setShowAddModal(true)} variant="primary">
              <Plus size={14} className="mr-1" /> Add Device
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <div className="p-2 bg-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {devices.length === 0 ? (
            <p className="text-neutral-500 text-center py-4">
              No devices configured. Click "Add Device" to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => {
                const online = statuses[device.ip];
                const isWaking = waking === device.mac;

                return (
                  <div
                    key={device.mac}
                    className={`flex items-center justify-between p-3 rounded-lg
                               ${online ? 'bg-green-500/20' : 'bg-neutral-700/30'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Monitor size={20} className={online ? 'text-green-400' : 'text-neutral-500'} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{device.name}</div>
                        <div className="text-xs text-neutral-500">{device.ip}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${online ? 'bg-green-500/30 text-green-400' : 'bg-neutral-600 text-neutral-400'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                      {!online && (
                        <button
                          onClick={() => handleWake(device)}
                          disabled={isWaking}
                          className="p-2 rounded bg-blue-500/80 hover:bg-blue-500 text-white disabled:opacity-50"
                          title="Wake"
                        >
                          <Power size={16} className={isWaking ? 'animate-pulse' : ''} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteDevice(device)}
                        className="p-2 rounded hover:bg-red-500/30"
                        title="Delete"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading && devices.length > 0 && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Checking status...
            </div>
          )}
        </div>
      </Modal>

      {/* Add Device Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddError(null);
        }}
        title="Add Device"
        actions={
          <>
            <Button onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} variant="primary">
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-neutral-500 mb-1">Device Name</label>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Gaming PC"
              className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-500 mb-1">IP Address</label>
            <input
              type="text"
              value={addForm.ip}
              onChange={(e) => setAddForm((p) => ({ ...p, ip: e.target.value }))}
              placeholder="e.g., 192.168.1.100"
              className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-500 mb-1">
              MAC Address <span className="text-neutral-600">(auto-detected if online)</span>
            </label>
            <input
              type="text"
              value={addForm.mac}
              onChange={(e) => setAddForm((p) => ({ ...p, mac: e.target.value }))}
              placeholder="Leave empty to auto-detect"
              className="w-full px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600"
            />
          </div>
          {addError && (
            <p className={`text-sm ${addError.includes('Detecting') ? 'text-blue-400' : 'text-red-500'}`}>
              {addError}
            </p>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteDevice}
        onClose={() => setDeleteDevice(null)}
        onConfirm={handleDelete}
        title="Delete Device"
        message={`Remove "${deleteDevice?.name}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
