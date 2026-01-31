import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { RefreshCw, Pencil, Trash2, Plus, X, Check, ExternalLink } from 'lucide-react';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import { Modal, Button, Spinner, Alert, Card, Input } from '@dak/ui';
import {
  client,
  listDevicesMqttDevicesGet,
  setPermitJoinMqttPermitJoinPost,
  renameDeviceMqttDevicesRenamePost,
  removeDeviceMqttDevicesRemovePost,
  type DeviceListResponse,
  type ZigbeeDevice,
} from '@dak/api-client';

async function fetchDevices(): Promise<DeviceListResponse> {
  client.setConfig({ baseUrl: getRelayUrl() });
  const result = await listDevicesMqttDevicesGet({ throwOnError: true });
  return result.data;
}

async function setPermitJoin(enable: boolean, time: number = 120): Promise<void> {
  client.setConfig({ baseUrl: getRelayUrl() });
  await setPermitJoinMqttPermitJoinPost({
    body: { enable, time },
    throwOnError: true,
  });
}

async function renameDevice(oldName: string, newName: string): Promise<void> {
  client.setConfig({ baseUrl: getRelayUrl() });
  await renameDeviceMqttDevicesRenamePost({
    body: { old_name: oldName, new_name: newName },
    throwOnError: true,
  });
}

async function removeDevice(device: string, force: boolean = false): Promise<void> {
  client.setConfig({ baseUrl: getRelayUrl() });
  await removeDeviceMqttDevicesRemovePost({
    body: { device, force },
    throwOnError: true,
  });
}

const DEFAULT_ZIGBEE_URL = 'https://zigbee2mqtt.bkemper.me';

export function MqttModal() {
  const queryClient = useQueryClient();
  const showModal = useConfigStore((s) => s.mqttModalOpen);
  const setShowModal = useConfigStore((s) => s.setMqttModalOpen);
  const zigbeeUrl = useConfigStore((s) => s.globalSettings?.zigbeeUrl) ?? DEFAULT_ZIGBEE_URL;
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairingCountdown, setPairingCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mqtt-devices'],
    queryFn: fetchDevices,
    refetchInterval: (query) => {
      if (!showModal) return 30_000;
      // Poll faster when actively pairing
      return query.state.data?.permit_join ? 1_000 : 3_000;
    },
    staleTime: 1000,
    enabled: showModal,
  });

  // Handle countdown timer for pairing mode
  const permitTimeout =
    data?.permit_join && data.permit_join_timeout && data.permit_join_timeout > 0
      ? data.permit_join_timeout
      : null;

  useEffect(() => {
    if (permitTimeout === null) {
      setPairingCountdown(null);
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

  function handleClose() {
    setShowModal(false);
    setEditingDevice(null);
    setDeleteConfirm(null);
    setError(null);
  }

  return (
    <Modal
      open={showModal}
      onClose={handleClose}
      title="Zigbee Devices"
      wide
      actions={
        <>
          <Button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <Spinner size="sm" className="mr-1" />
            ) : (
              <RefreshCw size={14} className="mr-1" />
            )}{' '}
            Refresh
          </Button>
          <Button onClick={handleClose} variant="primary">
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Pairing Mode Toggle */}
        <div className={`p-3 rounded-lg ${permitJoin ? 'bg-success/20' : 'bg-surface-sunken/40'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium flex items-center gap-2">
                <Plus size={16} />
                Pairing Mode
              </div>
              <div className="text-sm text-text-muted">
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
              {permitJoinMutation.isPending ? <Spinner size="sm" /> : permitJoin ? 'Stop' : 'Start'}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Device List */}
        {devices.length === 0 && !isLoading && (
          <p className="text-text-muted text-center py-4">No Zigbee devices found.</p>
        )}

        {devices.length > 0 && (
          <div className="space-y-2">
            {devices.map((device) => (
              <Card
                key={device.ieee_address}
                variant="sunken"
                padding="sm"
                className="bg-surface-sunken/40"
              >
                {editingDevice === device.friendly_name ? (
                  // Edit Mode
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      inline
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') {
                          setEditingDevice(null);
                          setEditName('');
                        }
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleSaveEdit}
                      className="hover:bg-success/20 text-success"
                      disabled={renameMutation.isPending}
                    >
                      <Check size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingDevice(null);
                        setEditName('');
                      }}
                      className="hover:bg-danger/20 text-danger"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ) : deleteConfirm === device.friendly_name ? (
                  // Delete Confirmation
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-danger">Remove {device.friendly_name}?</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        onClick={() => removeMutation.mutate(device.friendly_name)}
                        disabled={removeMutation.isPending}
                      >
                        {removeMutation.isPending ? <Spinner size="sm" /> : 'Remove'}
                      </Button>
                      <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  // Normal Display
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{device.friendly_name}</div>
                      <div className="text-xs text-text-muted truncate">
                        {device.model || device.vendor || device.ieee_address}
                        {device.description && ` - ${device.description}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          device.type === 'Router'
                            ? 'bg-accent/20 text-accent'
                            : 'bg-surface/20 text-text-muted'
                        }`}
                      >
                        {device.type}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleStartEdit(device)}
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteConfirm(device.friendly_name)}
                        className="hover:bg-danger/20 text-danger"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Spinner size="sm" /> Loading devices...
          </div>
        )}

        {/* Zigbee2MQTT UI Link */}
        {zigbeeUrl && (
          <div className="pt-2 border-t border-border">
            <a
              href={zigbeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded text-sm text-text-secondary bg-surface-sunken/40 hover:bg-surface-sunken transition-colors"
            >
              <ExternalLink size={14} />
              Open Zigbee2MQTT UI
            </a>
            <p className="text-xs mt-1 text-text-muted text-center">
              Advanced settings, routing, and signal info
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
