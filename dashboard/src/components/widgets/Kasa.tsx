import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useToggle } from '@dak/hooks';
import {
  Power,
  RefreshCw,
  AlertCircle,
  Sun,
  Zap,
  Timer,
  Calendar,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { getRelayUrl } from '../../stores/config-store';
import { Modal, Button, ConfirmModal, TimePickerCompact, Toggle, Badge, Spinner, Alert, Slider } from '@dak/ui';
import {
  createKasaClient,
  hasBrightness,
  formatCountdown,
  formatScheduleTime,
  type KasaDevice,
  type ScheduleRule,
} from '@dak/kasa-client';
import type { WidgetComponentProps } from './index';

export default function Kasa({ dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const relayUrl = getRelayUrl();
  const client = useMemo(() => createKasaClient(relayUrl), [relayUrl]);
  const prevDevicesRef = useRef<KasaDevice[]>([]);
  const showModal = useToggle(false);
  const [selectedDevice, setSelectedDevice] = useState<KasaDevice | null>(null);
  const [countdownMins, setCountdownMins] = useState(30);
  const [countdownAction, setCountdownAction] = useState<'on' | 'off'>('off');
  const [countdownStatus, setCountdownStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Schedule state
  const showScheduleForm = useToggle(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<ScheduleRule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    action: 'on' as 'on' | 'off',
    timeType: 'specific' as 'specific' | 'sunrise' | 'sunset',
    time: '07:00',
    offsetMins: 0,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['kasa-devices', relayUrl],
    queryFn: async (): Promise<{ devices: KasaDevice[]; error: string | null }> => {
      try {
        const relayUp = await client.checkHealth();
        if (!relayUp) {
          return { devices: prevDevicesRef.current, error: 'Relay offline' };
        }
        const found = await client.discoverDevices();
        if (found.length === 0) {
          return { devices: prevDevicesRef.current, error: 'No devices found' };
        }
        // Merge: update found devices, keep stale ones that didn't respond
        const foundMap = new Map(
          found.map((d) => [d.child_id ? `${d.ip}:${d.child_id}` : d.ip, d]),
        );
        const merged: KasaDevice[] = [];
        // Keep previous devices, update with new data if available
        for (const old of prevDevicesRef.current) {
          const key = old.child_id ? `${old.ip}:${old.child_id}` : old.ip;
          merged.push(foundMap.get(key) ?? old);
          foundMap.delete(key);
        }
        // Add new devices not seen before
        for (const d of foundMap.values()) {
          merged.push(d);
        }
        prevDevicesRef.current = merged;
        return { devices: merged, error: null };
      } catch {
        return { devices: prevDevicesRef.current, error: 'Failed to discover devices' };
      }
    },
    refetchInterval: showModal.value ? 5_000 : 60_000,
    staleTime: 5000,
  });

  const brightnessMutation = useMutation({
    mutationFn: ({ ip, brightness }: { ip: string; brightness: number }) =>
      client.setBrightness(ip, brightness),
    onSuccess: (success) => {
      if (success) {
        setMutationError(null);
        queryClient.invalidateQueries({ queryKey: ['kasa-devices', relayUrl] });
      } else {
        setMutationError('Failed to set brightness');
      }
    },
  });

  const countdownMutation = useMutation({
    mutationFn: ({ ip, minutes, action }: { ip: string; minutes: number; action: 'on' | 'off' }) =>
      client.setCountdown(ip, minutes, action),
    onSuccess: (success) => {
      if (success) {
        setCountdownStatus('success');
        setMutationError(null);
        setTimeout(() => setCountdownStatus('idle'), 3000);
      } else {
        setCountdownStatus('error');
        setMutationError('Device may not support timers');
        setTimeout(() => setCountdownStatus('idle'), 3000);
      }
    },
  });

  // Schedule query - only fetch when device is selected
  // For child devices (multi-plugs), pass child_id to query with context
  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useQuery({
    queryKey: ['kasa-schedule', relayUrl, selectedDevice?.ip, selectedDevice?.child_id],
    queryFn: () =>
      selectedDevice ? client.getSchedule(selectedDevice.ip, selectedDevice.child_id) : null,
    enabled: !!selectedDevice,
    staleTime: 10000,
    retry: false, // Don't retry on failure (device may not support schedules)
  });

  const scheduleMutation = useMutation({
    mutationFn: async (params: {
      type: 'add' | 'update' | 'delete' | 'toggle';
      ip: string;
      ruleId?: string;
      action?: 'on' | 'off';
      time?: string;
      days?: string[];
      enabled?: boolean;
    }) => {
      if (params.type === 'add') {
        return client.addScheduleRule(params.ip, params.action!, params.time!, params.days!);
      } else if (params.type === 'update') {
        return client.updateScheduleRule(params.ip, params.ruleId!, {
          action: params.action,
          time: params.time,
          days: params.days,
        });
      } else if (params.type === 'toggle') {
        return client.updateScheduleRule(params.ip, params.ruleId!, { enabled: params.enabled });
      } else {
        return client.deleteScheduleRule(params.ip, params.ruleId!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasa-schedule', relayUrl, selectedDevice?.ip] });
      showScheduleForm.setFalse();
      setEditingRule(null);
      setDeleteRule(null);
    },
  });

  const devices = [...(data?.devices ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const error = data?.error ?? null;

  async function handleToggle(device: KasaDevice) {
    const queryKey = ['kasa-devices', relayUrl];
    // Optimistic update
    queryClient.setQueryData(
      queryKey,
      (old: { devices: KasaDevice[]; error: string | null } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          devices: old.devices.map((d) => (d.ip === device.ip ? { ...d, on: !d.on } : d)),
        };
      },
    );

    const success = await client.toggleDevice(device.ip);
    if (!success) {
      // Revert on failure
      queryClient.setQueryData(
        queryKey,
        (old: { devices: KasaDevice[]; error: string | null } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            devices: old.devices.map((d) => (d.ip === device.ip ? { ...d, on: device.on } : d)),
          };
        },
      );
    }
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['kasa-devices', relayUrl] });
  }

  // Status indicator
  const anyOn = devices.some((d) => d.on);
  const hasError = !!error;

  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* Compact icon button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => showModal.setTrue()}
        className="relative"
        title={`Smart Devices${devices.length > 0 ? ` (${devices.length})` : ''}`}
      >
        <Power size={24} className={anyOn ? 'text-success' : 'text-text-muted'} />
        {hasError && <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-danger" />}
        {isLoading && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
      </Button>

      {/* Main Modal - Device List */}
      <Modal
        open={showModal.value && !selectedDevice}
        onClose={() => showModal.setFalse()}
        title="Smart Devices"
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
            <Button onClick={() => showModal.setFalse()} variant="primary">
              Close
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <Alert variant="error">
              {error}
              {error === 'Relay offline' && (
                <span className="text-text-muted text-xs ml-2">Is home-relay running?</span>
              )}
            </Alert>
          )}

          {devices.length === 0 && !error && !isLoading && (
            <p className="text-text-muted text-center py-4">No smart devices discovered.</p>
          )}

          {devices.length > 0 && (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.child_id ? `${device.ip}:${device.child_id}` : device.ip}
                  className={`p-3 rounded-lg transition-colors
                             ${device.on ? 'bg-success/20' : 'bg-surface-sunken/40'}`}
                >
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedDevice(device)}
                      className="font-medium truncate text-left hover:underline p-0 h-auto"
                    >
                      {device.name}
                    </Button>
                    <div className="flex items-center gap-2">
                      {/* Countdown timer takes priority */}
                      {device.countdown_remaining && device.countdown_remaining > 0 ? (
                        <span className="text-xs text-accent">
                          {device.countdown_action ?? 'off'} in{' '}
                          {formatCountdown(device.countdown_remaining)}
                        </span>
                      ) : device.next_action && device.next_action_at ? (
                        <span className="text-xs text-accent">
                          {device.next_action} at {device.next_action_at}
                        </span>
                      ) : null}
                      {/* Power usage */}
                      {device.has_emeter && device.power_watts != null && device.on && (
                        <span className="text-xs text-warning flex items-center gap-1">
                          <Zap size={10} />
                          {device.power_watts!.toFixed(1)}W
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        rounded
                        onClick={() => handleToggle(device)}
                        className={
                          device.on
                            ? 'bg-success/30 hover:bg-success/50'
                            : dark
                              ? 'bg-surface-sunken hover:bg-surface'
                              : 'bg-surface-sunken hover:bg-border'
                        }
                      >
                        <Power
                          size={16}
                          className={device.on ? 'text-success' : 'text-text-muted'}
                        />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Spinner size="sm" /> Discovering devices...
            </div>
          )}
        </div>
      </Modal>

      {/* Device Detail Modal */}
      <Modal
        open={!!selectedDevice}
        onClose={() => setSelectedDevice(null)}
        title={selectedDevice?.name ?? 'Device'}
        actions={
          <Button onClick={() => setSelectedDevice(null)} variant="primary">
            Close
          </Button>
        }
      >
        {selectedDevice && (
          <div className="space-y-4">
            {/* Status */}
            <div
              className={`p-3 rounded-lg ${selectedDevice.on ? 'bg-success/20' : 'bg-surface-sunken/40'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Power</span>
                <Button
                  size="sm"
                  onClick={() => {
                    handleToggle(selectedDevice);
                    // Update local state
                    setSelectedDevice({ ...selectedDevice, on: !selectedDevice.on });
                  }}
                  className={
                    selectedDevice.on ? 'bg-success/30 text-success hover:bg-success/40' : ''
                  }
                  variant={selectedDevice.on ? 'secondary' : 'secondary'}
                >
                  {selectedDevice.on ? 'On' : 'Off'}
                </Button>
              </div>
              {/* Next action info - countdown takes priority */}
              {selectedDevice.countdown_remaining && selectedDevice.countdown_remaining > 0 ? (
                <div className="text-sm text-accent mt-1 flex items-center gap-1">
                  <Timer size={12} />
                  Turning {selectedDevice.countdown_action ?? 'off'} in{' '}
                  {formatCountdown(selectedDevice.countdown_remaining)}
                </div>
              ) : selectedDevice.next_action && selectedDevice.next_action_at ? (
                <div className="text-sm text-accent mt-1">
                  {selectedDevice.next_action === 'off' ? 'Turns off' : 'Turns on'} at{' '}
                  {selectedDevice.next_action_at}
                </div>
              ) : null}
            </div>

            {/* Brightness */}
            {hasBrightness(selectedDevice) && selectedDevice.brightness != null && (
              <div className={`p-3 rounded-lg bg-surface-sunken/40`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <Sun size={16} className="text-warning" /> Brightness
                  </span>
                  <span className="text-text-muted">
                    {brightnessMutation.isPending ? '...' : `${selectedDevice.brightness}%`}
                  </span>
                </div>
                {mutationError && mutationError.includes('brightness') && (
                  <div className="text-xs text-danger mb-2">{mutationError}</div>
                )}
                <Slider
                  min={1}
                  max={100}
                  value={selectedDevice.brightness}
                  onChange={(value) =>
                    setSelectedDevice({
                      ...selectedDevice,
                      brightness: value,
                    })
                  }
                  onMouseUp={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    brightnessMutation.mutate({ ip: selectedDevice.ip, brightness: val });
                  }}
                  onTouchEnd={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    brightnessMutation.mutate({ ip: selectedDevice.ip, brightness: val });
                  }}
                  disabled={!selectedDevice.on}
                  thumbColor="warning"
                />
              </div>
            )}

            {/* Energy */}
            {selectedDevice.has_emeter && (
              <div className={`p-3 rounded-lg bg-surface-sunken/40`}>
                <div className="font-medium flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-warning" /> Energy
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Current</span>
                    <div className="font-medium">
                      {selectedDevice.power_watts?.toFixed(1) ?? '--'} W
                    </div>
                  </div>
                  <div>
                    <span className="text-text-muted">Today</span>
                    <div className="font-medium">
                      {selectedDevice.energy_today_kwh?.toFixed(2) ?? '--'} kWh
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Countdown Timer */}
            <div className={`p-3 rounded-lg bg-surface-sunken/40`}>
              <div className="font-medium flex items-center gap-2 mb-2">
                <Timer size={16} className="text-accent" /> Timer
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  size="sm"
                  onClick={() => setCountdownAction('off')}
                  className={`flex-1 ${countdownAction === 'off' ? 'bg-danger hover:bg-danger' : ''}`}
                  variant={countdownAction === 'off' ? 'danger' : 'secondary'}
                >
                  Turn Off
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCountdownAction('on')}
                  className={`flex-1 ${countdownAction === 'on' ? 'bg-success hover:bg-success' : ''}`}
                  variant="secondary"
                >
                  Turn On
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={countdownMins}
                  onChange={(e) => setCountdownMins(parseInt(e.target.value, 10))}
                  className={`flex-1 px-2 py-1 rounded text-sm bg-surface-sunken`}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                </select>
                <Button
                  onClick={() =>
                    countdownMutation.mutate({
                      ip: selectedDevice.ip,
                      minutes: countdownMins,
                      action: countdownAction,
                    })
                  }
                  disabled={countdownMutation.isPending}
                >
                  {countdownMutation.isPending
                    ? 'Setting...'
                    : countdownStatus === 'success'
                      ? 'Set!'
                      : 'Set'}
                </Button>
              </div>
              {countdownStatus === 'success' && (
                <div className="text-xs text-success mt-1">
                  Will turn {countdownAction} in {countdownMins} minutes
                </div>
              )}
              {countdownStatus === 'error' && (
                <div className="text-xs text-danger mt-1">{mutationError}</div>
              )}
            </div>

            {/* Schedules */}
            <div className={`p-3 rounded-lg bg-surface-sunken/40`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium flex items-center gap-2">
                  <Calendar size={16} className="text-accent" /> Schedules
                </span>
                <Button
                  onClick={() => {
                    setEditingRule(null);
                    setScheduleForm({
                      action: 'on',
                      timeType: 'specific',
                      time: '07:00',
                      offsetMins: 0,
                      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
                    });
                    showScheduleForm.setTrue();
                  }}
                >
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>

              {scheduleLoading ? (
                <div className="text-sm text-text-muted">Loading schedules...</div>
              ) : scheduleError ? (
                <div className="text-sm text-danger">
                  Error: {scheduleError instanceof Error ? scheduleError.message : 'Failed to load'}
                </div>
              ) : scheduleData?.rules && scheduleData.rules.length > 0 ? (
                <div className="space-y-2">
                  {scheduleData.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-center justify-between p-2 rounded ${'bg-surface-sunken/50'} ${!rule.enabled ? 'opacity-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.action === 'on' ? 'success' : 'danger'} size="sm">
                            {rule.action.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{formatScheduleTime(rule)}</span>
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {rule.days
                            .map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3))
                            .join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Toggle
                          size="sm"
                          checked={rule.enabled}
                          onChange={() =>
                            scheduleMutation.mutate({
                              type: 'toggle',
                              ip: selectedDevice.ip,
                              ruleId: rule.id,
                              enabled: !rule.enabled,
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditingRule(rule);
                            const isSunrise = rule.time === 'sunrise';
                            const isSunset = rule.time === 'sunset';
                            setScheduleForm({
                              action: rule.action as 'on' | 'off',
                              timeType: isSunrise ? 'sunrise' : isSunset ? 'sunset' : 'specific',
                              time: isSunrise || isSunset ? '07:00' : rule.time,
                              offsetMins: rule.offset_mins ?? 0,
                              days: rule.days,
                            });
                            showScheduleForm.setTrue();
                          }}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteRule(rule)}
                          className="hover:bg-danger/50"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-danger" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-muted">No schedules configured</div>
              )}
            </div>

            {/* Device Info */}
            <div className="text-xs text-text-muted space-y-1">
              <div>Model: {selectedDevice.model}</div>
              <div>IP: {selectedDevice.ip}</div>
              {selectedDevice.features && selectedDevice.features.length > 0 && (
                <div>Features: {selectedDevice.features.join(', ')}</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule Form Modal */}
      <Modal
        open={showScheduleForm.value}
        onClose={() => {
          showScheduleForm.setFalse();
          setEditingRule(null);
        }}
        title={editingRule ? 'Edit Schedule' : 'Add Schedule'}
        actions={
          <>
            <Button
              onClick={() => {
                showScheduleForm.setFalse();
                setEditingRule(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (selectedDevice) {
                  const timeValue =
                    scheduleForm.timeType === 'specific'
                      ? scheduleForm.time
                      : scheduleForm.timeType;
                  if (editingRule) {
                    scheduleMutation.mutate({
                      type: 'update',
                      ip: selectedDevice.ip,
                      ruleId: editingRule.id,
                      action: scheduleForm.action,
                      time: timeValue,
                      days: scheduleForm.days,
                    });
                  } else {
                    scheduleMutation.mutate({
                      type: 'add',
                      ip: selectedDevice.ip,
                      action: scheduleForm.action,
                      time: timeValue,
                      days: scheduleForm.days,
                    });
                  }
                }
              }}
              disabled={scheduleMutation.isPending || scheduleForm.days.length === 0}
            >
              {scheduleMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Action */}
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <div className="flex gap-2">
              <Button
                onClick={() => setScheduleForm((f) => ({ ...f, action: 'on' }))}
                variant={scheduleForm.action === 'on' ? 'primary' : 'secondary'}
                className={`flex-1 ${scheduleForm.action === 'on' ? 'bg-success hover:bg-success' : ''}`}
              >
                Turn On
              </Button>
              <Button
                onClick={() => setScheduleForm((f) => ({ ...f, action: 'off' }))}
                variant={scheduleForm.action === 'off' ? 'danger' : 'secondary'}
                className="flex-1"
              >
                Turn Off
              </Button>
            </div>
          </div>

          {/* Time Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Time</label>
            <div className="flex gap-2 mb-2">
              {(['specific', 'sunrise', 'sunset'] as const).map((type) => (
                <Button
                  key={type}
                  onClick={() => setScheduleForm((f) => ({ ...f, timeType: type }))}
                  variant={scheduleForm.timeType === type ? 'primary' : 'secondary'}
                  size="sm"
                  className="flex-1"
                >
                  {type === 'specific' ? 'Time' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
            {scheduleForm.timeType === 'specific' ? (
              <TimePickerCompact
                value={scheduleForm.time}
                onChange={(time) => setScheduleForm((f) => ({ ...f, time }))}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">Offset:</span>
                <input
                  type="number"
                  value={scheduleForm.offsetMins}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      offsetMins: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className={`w-20 px-2 py-1 rounded text-sm bg-surface-sunken`}
                />
                <span className="text-sm text-text-muted">minutes</span>
              </div>
            )}
          </div>

          {/* Days */}
          <div>
            <label className="block text-sm font-medium mb-1">Days</label>
            <div className="flex gap-1">
              {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((day) => (
                <Button
                  key={day}
                  onClick={() =>
                    setScheduleForm((f) => ({
                      ...f,
                      days: f.days.includes(day)
                        ? f.days.filter((d) => d !== day)
                        : [...f.days, day],
                    }))
                  }
                  variant={scheduleForm.days.includes(day) ? 'primary' : 'secondary'}
                  className="w-9 h-9 p-0"
                >
                  {day.charAt(0).toUpperCase()}
                </Button>
              ))}
            </div>
            {scheduleForm.days.length === 0 && (
              <div className="text-xs text-danger mt-1">Select at least one day</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Schedule Confirm */}
      <ConfirmModal
        open={!!deleteRule}
        onClose={() => setDeleteRule(null)}
        onConfirm={() => {
          if (selectedDevice && deleteRule) {
            scheduleMutation.mutate({
              type: 'delete',
              ip: selectedDevice.ip,
              ruleId: deleteRule.id,
            });
          }
        }}
        title="Delete Schedule"
        message={`Delete this schedule (${deleteRule?.action.toUpperCase()} at ${deleteRule?.time})?`}
        confirmText="Delete"
      />
    </div>
  );
}
