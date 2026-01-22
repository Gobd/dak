import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Radio, RefreshCw, AlertCircle, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { getRelayUrl } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import type { WidgetComponentProps } from './index';

interface ZigbeeDevice {
  friendly_name: string;
  ieee_address: string;
  type: 'Coordinator' | 'Router' | 'EndDevice';
  network_address: number;
  model: string | null;
  vendor: string | null;
  description: string | null;
  power_source: string | null;
  supported: boolean;
  interviewing: boolean;
  interview_completed: boolean;
}

interface DeviceListResponse {
  devices: ZigbeeDevice[];
  permit_join: boolean;
  permit_join_timeout: number | null;
}

async function fetchDevices(): Promise<DeviceListResponse> {
  const res = await fetch(`${getRelayUrl()}/mqtt/devices`);
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}

async function setPermitJoin(enable: boolean, time: number = 120): Promise<void> {
  const res = await fetch(`${getRelayUrl()}/mqtt/permit-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enable, time }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to set permit join');
  }
}

async function renameDevice(oldName: string, newName: string): Promise<void> {
  const res = await fetch(`${getRelayUrl()}/mqtt/devices/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to rename device');
  }
}

async function removeDevice(device: string, force: boolean = false): Promise<void> {
  const res = await fetch(`${getRelayUrl()}/mqtt/devices/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, force }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to remove device');
  }
}

export default function Mqtt({ dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairingCountdown, setPairingCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mqtt-devices'],
    queryFn: fetchDevices,
    refetchInterval: showModal ? 3_000 : 30_000,
    staleTime: 3000,
  });

  // Handle countdown timer for pairing mode
  const permitTimeout =
    data?.permit_join && data.permit_join_timeout && data.permit_join_timeout > 0
      ? data.permit_join_timeout
      : null;

  useEffect(() => {
    if (permitTimeout === null) {
      setPairingCountdown(null); // eslint-disable-line react-hooks/set-state-in-effect -- sync derived state
      return;
    }

    setPairingCountdown(permitTimeout);
    countdownRef.current = setInterval(() => {
      setPairingCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          refetch();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [permitTimeout, refetch]);

  const permitJoinMutation = useMutation({
    mutationFn: ({ enable, time }: { enable: boolean; time?: number }) =>
      setPermitJoin(enable, time),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['mqtt-devices'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to toggle pairing'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      renameDevice(oldName, newName),
    onSuccess: () => {
      setError(null);
      setEditingDevice(null);
      setEditName('');
      queryClient.invalidateQueries({ queryKey: ['mqtt-devices'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to rename device'),
  });

  const removeMutation = useMutation({
    mutationFn: (device: string) => removeDevice(device),
    onSuccess: () => {
      setError(null);
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['mqtt-devices'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to remove device'),
  });

  const devices = data?.devices.filter((d) => d.type !== 'Coordinator') ?? [];
  const permitJoin = data?.permit_join ?? false;

  function handleStartEdit(device: ZigbeeDevice) {
    setEditingDevice(device.friendly_name);
    setEditName(device.friendly_name);
    setError(null);
  }

  function handleSaveEdit() {
    if (editingDevice && editName.trim() && editName !== editingDevice) {
      renameMutation.mutate({ oldName: editingDevice, newName: editName.trim() });
    } else {
      setEditingDevice(null);
      setEditName('');
    }
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['mqtt-devices'] });
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* Compact icon button */}
      <button
        onClick={() => setShowModal(true)}
        className={`relative p-2 rounded-lg transition-colors ${dark ? 'hover:bg-neutral-700/30' : 'hover:bg-neutral-200/50'}`}
        title={`Zigbee Devices${devices.length > 0 ? ` (${devices.length})` : ''}`}
      >
        <Radio
          size={24}
          className={permitJoin ? 'text-green-400 animate-pulse' : 'text-neutral-500'}
        />
        {isLoading && (
          <RefreshCw size={10} className="absolute top-0.5 right-0.5 text-blue-400 animate-spin" />
        )}
        {devices.length > 0 && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 text-[9px] px-1 rounded ${dark ? 'bg-neutral-600' : 'bg-neutral-300 text-neutral-700'}`}
          >
            {devices.length}
          </span>
        )}
      </button>

      {/* Device Management Modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDevice(null);
          setDeleteConfirm(null);
          setError(null);
        }}
        title="Zigbee Devices"
        wide
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
        <div className="space-y-4">
          {/* Pairing Mode Toggle */}
          <div
            className={`p-3 rounded-lg ${permitJoin ? 'bg-green-500/20' : dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Plus size={16} />
                  Pairing Mode
                </div>
                <div className="text-sm text-neutral-500">
                  {permitJoin
                    ? pairingCountdown
                      ? `Active - ${pairingCountdown}s remaining`
                      : 'Active - waiting for devices'
                    : 'Enable to add new devices'}
                </div>
              </div>
              <Button
                variant={permitJoin ? 'danger' : 'primary'}
                onClick={() => permitJoinMutation.mutate({ enable: !permitJoin, time: 120 })}
                disabled={permitJoinMutation.isPending}
              >
                {permitJoinMutation.isPending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : permitJoin ? (
                  'Stop'
                ) : (
                  'Start'
                )}
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2 bg-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Device List */}
          {devices.length === 0 && !isLoading && (
            <p className="text-neutral-500 text-center py-4">No Zigbee devices found.</p>
          )}

          {devices.length > 0 && (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.ieee_address}
                  className={`p-3 rounded-lg ${dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}
                >
                  {editingDevice === device.friendly_name ? (
                    // Edit Mode
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') {
                            setEditingDevice(null);
                            setEditName('');
                          }
                        }}
                        className={`flex-1 px-2 py-1 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 rounded hover:bg-green-500/20 text-green-400"
                        disabled={renameMutation.isPending}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingDevice(null);
                          setEditName('');
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : deleteConfirm === device.friendly_name ? (
                    // Delete Confirmation
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-400">Remove {device.friendly_name}?</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="danger"
                          onClick={() => removeMutation.mutate(device.friendly_name)}
                          disabled={removeMutation.isPending}
                        >
                          {removeMutation.isPending ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            'Remove'
                          )}
                        </Button>
                        <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    // Normal Display
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{device.friendly_name}</div>
                        <div className="text-xs text-neutral-500 truncate">
                          {device.model || device.vendor || device.ieee_address}
                          {device.description && ` - ${device.description}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            device.type === 'Router'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-neutral-500/20 text-neutral-400'
                          }`}
                        >
                          {device.type}
                        </span>
                        <button
                          onClick={() => handleStartEdit(device)}
                          className={`p-1.5 rounded ${dark ? 'hover:bg-neutral-600' : 'hover:bg-neutral-300'}`}
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(device.friendly_name)}
                          className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Loading devices...
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
