import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToggle } from '@dak/hooks';
import { Power, Monitor, Trash2, Plus, AlertCircle } from 'lucide-react';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { Modal, Button, ConfirmModal, Badge, Spinner, Input, Alert } from '@dak/ui';
import {
  client,
  healthHealthGet,
  pingWolPingGet,
  wakeWolWakePost,
  lookupMacWolMacGet,
} from '@dak/api-client';
import type { WidgetComponentProps } from './index';

interface WolDevice {
  name: string;
  mac: string;
  ip: string;
}

interface WolData {
  statuses: Record<string, boolean>;
  error: string | null;
}

async function pingDevice(ip: string): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    const result = await pingWolPingGet({ query: { ip } });
    return result.data?.online === true;
  } catch {
    return false;
  }
}

async function wakeDevice(mac: string): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    await wakeWolWakePost({ body: { mac }, throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

async function getMacFromIp(ip: string): Promise<string | null> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    const result = await lookupMacWolMacGet({ query: { ip } });
    return result.data?.mac || null;
  } catch {
    return null;
  }
}

async function checkRelayHealth(): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: getRelayUrl() });
    await healthHealthGet({ throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

async function fetchWolStatuses(devices: WolDevice[]): Promise<WolData> {
  const relayUp = await checkRelayHealth();
  if (!relayUp) {
    return { statuses: {}, error: 'Relay offline' };
  }

  if (devices.length === 0) {
    return { statuses: {}, error: null };
  }

  try {
    const results = await Promise.all(
      devices.map(async (d) => ({
        ip: d.ip,
        online: await pingDevice(d.ip),
      })),
    );

    const statuses: Record<string, boolean> = {};
    results.forEach((r) => {
      statuses[r.ip] = r.online;
    });
    return { statuses, error: null };
  } catch {
    return { statuses: {}, error: 'Could not connect' };
  }
}

export default function Wol({ panel }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const widgetId = panel.id || 'wol';

  // Get devices from config - memoize to prevent unnecessary re-renders
  const config = useConfigStore((s) => s.locations?.[widgetId]) as unknown as
    | { devices?: WolDevice[] }
    | undefined;
  const updateLocation = useConfigStore((s) => s.updateLocation);
  const devices = useMemo(() => config?.devices ?? [], [config?.devices]);

  const showModal = useToggle(false);
  const [waking, setWaking] = useState<string | null>(null);
  const showAddModal = useToggle(false);
  const [deleteDevice, setDeleteDevice] = useState<WolDevice | null>(null);
  const [addForm, setAddForm] = useState({ name: '', ip: '', mac: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const detectingMac = useToggle(false);

  const { data, isLoading } = useQuery({
    queryKey: ['wol-statuses', devices.map((d) => d.ip).join(',')],
    queryFn: () => fetchWolStatuses(devices),
    refetchInterval: showModal.value ? 5_000 : 60_000,
    staleTime: 3000,
    enabled: devices.length > 0 || showModal.value,
  });

  const statuses = data?.statuses ?? {};
  const error = data?.error ?? null;

  const saveDevices = useCallback(
    (newDevices: WolDevice[]) => {
      updateLocation(widgetId, { devices: newDevices } as unknown as { lat: number; lon: number });
    },
    [widgetId, updateLocation],
  );

  async function handleWake(device: WolDevice) {
    setWaking(device.mac);
    await wakeDevice(device.mac);
    // Check status after a delay
    setTimeout(async () => {
      queryClient.invalidateQueries({ queryKey: ['wol-statuses'] });
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
    showAddModal.setFalse();
    setAddForm({ name: '', ip: '', mac: '' });
    setAddError(null);
    queryClient.invalidateQueries({ queryKey: ['wol-statuses'] });
  }

  function handleDelete() {
    if (!deleteDevice) return;
    saveDevices(devices.filter((d) => d.mac !== deleteDevice.mac));
    setDeleteDevice(null);
    queryClient.invalidateQueries({ queryKey: ['wol-statuses'] });
  }

  async function handleDetectMac() {
    if (!addForm.ip.trim()) {
      setAddError('Enter an IP address first');
      return;
    }
    detectingMac.setTrue();
    setAddError(null);
    const mac = await getMacFromIp(addForm.ip);
    detectingMac.setFalse();
    if (mac) {
      setAddForm((p) => ({ ...p, mac }));
    } else {
      setAddError('Could not detect MAC. Is the device online?');
    }
  }

  // Status indicator: green if any online, red if error
  const anyOnline = devices.length > 0 && Object.values(statuses).some((s) => s);
  const hasError = !!error;

  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* Compact icon button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => showModal.setTrue()}
        className="relative"
        title={`Wake on LAN${devices.length > 0 ? ` (${devices.length} devices)` : ''}`}
      >
        <Monitor size={24} className={anyOnline ? 'text-success' : 'text-text-muted'} />
        {hasError && <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-danger" />}
        {isLoading && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
        {!hasError && !isLoading && devices.length > 0 && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 text-[9px] px-1 rounded bg-surface-sunken`}
          >
            {Object.values(statuses).filter(Boolean).length}/{devices.length}
          </span>
        )}
      </Button>

      {/* Main Modal - Device List */}
      <Modal
        open={showModal.value}
        onClose={() => showModal.setFalse()}
        title="Wake on LAN"
        actions={
          <>
            <Button onClick={() => showModal.setFalse()}>Close</Button>
            <Button onClick={() => showAddModal.setTrue()} variant="primary">
              <Plus size={14} className="mr-1" /> Add Device
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}

          {devices.length === 0 ? (
            <p className="text-text-muted text-center py-4">
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
                               ${online ? 'bg-success/20' : 'bg-surface-sunken/40'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Monitor size={20} className={online ? 'text-success' : 'text-text-muted'} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{device.name}</div>
                        <div className="text-xs text-text-muted">{device.ip}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={online ? 'success' : 'default'} size="sm">
                        {online ? 'Online' : 'Offline'}
                      </Badge>
                      {!online && (
                        <Button
                          variant="primary"
                          size="icon-sm"
                          onClick={() => handleWake(device)}
                          disabled={isWaking}
                          title="Wake"
                        >
                          <Power size={16} className={isWaking ? 'animate-pulse' : ''} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteDevice(device)}
                        className="hover:bg-danger/30"
                        title="Delete"
                      >
                        <Trash2 size={16} className="text-danger" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isLoading && devices.length > 0 && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Spinner size="sm" /> Checking status...
            </div>
          )}
        </div>
      </Modal>

      {/* Add Device Modal */}
      <Modal
        open={showAddModal.value}
        onClose={() => {
          showAddModal.setFalse();
          setAddError(null);
        }}
        title="Add Device"
        actions={
          <>
            <Button onClick={() => showAddModal.setFalse()}>Cancel</Button>
            <Button onClick={handleAdd} variant="primary">
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Device Name"
            value={addForm.name}
            onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g., Gaming PC"
          />
          <Input
            label="IP Address"
            value={addForm.ip}
            onChange={(e) => setAddForm((p) => ({ ...p, ip: e.target.value }))}
            placeholder="e.g., 192.168.1.100"
          />
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              MAC Address
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={addForm.mac}
                  onChange={(e) => setAddForm((p) => ({ ...p, mac: e.target.value }))}
                  placeholder="e.g., AA:BB:CC:DD:EE:FF"
                />
              </div>
              <Button onClick={handleDetectMac} disabled={detectingMac.value || !addForm.ip.trim()}>
                {detectingMac.value ? 'Detecting...' : 'Detect'}
              </Button>
            </div>
          </div>
          {addError && (
            <p
              className={`text-sm ${addError.includes('Detecting') ? 'text-accent' : 'text-danger'}`}
            >
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
