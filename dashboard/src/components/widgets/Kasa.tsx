import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Power,
  RefreshCw,
  AlertCircle,
  Sun,
  Clock,
  Zap,
  Timer,
  Calendar,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { getRelayUrl } from '../../stores/config-store';
import { Modal, Button, ConfirmModal, TimePickerCompact } from '@dak/ui';
import {
  createKasaClient,
  hasBrightness,
  formatDuration,
  type KasaDevice,
  type ScheduleRule,
} from '@dak/kasa-client';
import type { WidgetComponentProps } from './index';

export default function Kasa({ dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const relayUrl = getRelayUrl();
  const client = useMemo(() => createKasaClient(relayUrl), [relayUrl]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<KasaDevice | null>(null);
  const [countdownMins, setCountdownMins] = useState(30);
  const [countdownStatus, setCountdownStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Schedule state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<ScheduleRule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    action: 'on' as 'on' | 'off',
    time: '07:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['kasa-devices', relayUrl],
    queryFn: async (): Promise<{ devices: KasaDevice[]; error: string | null }> => {
      try {
        const relayUp = await client.checkHealth();
        if (!relayUp) {
          return { devices: [], error: 'Relay offline' };
        }
        const found = await client.discoverDevices();
        if (found.length === 0) {
          return { devices: [], error: 'No devices found' };
        }
        return { devices: found, error: null };
      } catch {
        return { devices: [], error: 'Failed to discover devices' };
      }
    },
    refetchInterval: showModal ? 5_000 : 60_000,
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
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['kasa-schedule', relayUrl, selectedDevice?.ip],
    queryFn: () => (selectedDevice ? client.getSchedule(selectedDevice.ip) : null),
    enabled: !!selectedDevice,
    staleTime: 10000,
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
      setShowScheduleForm(false);
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
      }
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
        }
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
      <button
        onClick={() => setShowModal(true)}
        className={`relative p-2 rounded-lg transition-colors ${dark ? 'hover:bg-neutral-700/30' : 'hover:bg-neutral-200/50'}`}
        title={`Smart Devices${devices.length > 0 ? ` (${devices.length})` : ''}`}
      >
        <Power size={24} className={anyOn ? 'text-green-400' : 'text-neutral-500'} />
        {hasError && <AlertCircle size={10} className="absolute top-0.5 right-0.5 text-red-500" />}
        {isLoading && (
          <RefreshCw size={10} className="absolute top-0.5 right-0.5 text-blue-400 animate-spin" />
        )}
        {!hasError && !isLoading && devices.length > 0 && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 text-[9px] px-1 rounded ${dark ? 'bg-neutral-600' : 'bg-neutral-300 text-neutral-700'}`}
          >
            {devices.length}
          </span>
        )}
      </button>

      {/* Main Modal - Device List */}
      <Modal
        open={showModal && !selectedDevice}
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
                <div
                  key={device.ip}
                  className={`p-3 rounded-lg transition-colors
                             ${device.on ? 'bg-green-500/20' : dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedDevice(device)}
                      className="font-medium truncate text-left hover:underline"
                    >
                      {device.name}
                    </button>
                    <div className="flex items-center gap-2">
                      {/* Runtime indicator */}
                      {device.on && device.on_since && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatDuration(device.on_since)}
                        </span>
                      )}
                      {/* Power usage */}
                      {device.has_emeter && device.power_watts !== null && device.on && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <Zap size={10} />
                          {device.power_watts.toFixed(1)}W
                        </span>
                      )}
                      <button
                        onClick={() => handleToggle(device)}
                        className={`p-1.5 rounded-full transition-colors ${
                          device.on
                            ? 'bg-green-500/30 hover:bg-green-500/50'
                            : dark
                              ? 'bg-neutral-600 hover:bg-neutral-500'
                              : 'bg-neutral-300 hover:bg-neutral-400'
                        }`}
                      >
                        <Power
                          size={16}
                          className={device.on ? 'text-green-400' : 'text-neutral-500'}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Brightness slider for dimmable devices */}
                  {device.on && hasBrightness(device) && device.brightness !== null && (
                    <div className="mt-2 flex items-center gap-2">
                      <Sun size={14} className="text-yellow-400" />
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={device.brightness}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          // Update locally immediately
                          queryClient.setQueryData(
                            ['kasa-devices', relayUrl],
                            (old: { devices: KasaDevice[]; error: string | null } | undefined) => {
                              if (!old) return old;
                              return {
                                ...old,
                                devices: old.devices.map((d) =>
                                  d.ip === device.ip ? { ...d, brightness: val } : d
                                ),
                              };
                            }
                          );
                        }}
                        onMouseUp={(e) => {
                          const val = parseInt((e.target as HTMLInputElement).value, 10);
                          brightnessMutation.mutate({ ip: device.ip, brightness: val });
                        }}
                        onTouchEnd={(e) => {
                          const val = parseInt((e.target as HTMLInputElement).value, 10);
                          brightnessMutation.mutate({ ip: device.ip, brightness: val });
                        }}
                        className="flex-1 h-1 rounded-lg appearance-none cursor-pointer bg-neutral-600"
                      />
                      <span className="text-xs text-neutral-400 w-8">{device.brightness}%</span>
                    </div>
                  )}
                </div>
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
              className={`p-3 rounded-lg ${selectedDevice.on ? 'bg-green-500/20' : dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Power</span>
                <button
                  onClick={() => {
                    handleToggle(selectedDevice);
                    // Update local state
                    setSelectedDevice({ ...selectedDevice, on: !selectedDevice.on });
                  }}
                  className={`px-3 py-1 rounded ${
                    selectedDevice.on
                      ? 'bg-green-500/30 text-green-400'
                      : dark
                        ? 'bg-neutral-600 text-neutral-300'
                        : 'bg-neutral-300 text-neutral-700'
                  }`}
                >
                  {selectedDevice.on ? 'On' : 'Off'}
                </button>
              </div>
              {selectedDevice.on && selectedDevice.on_since && (
                <div className="text-sm text-neutral-400 mt-1">
                  On for {formatDuration(selectedDevice.on_since)}
                </div>
              )}
            </div>

            {/* Brightness */}
            {hasBrightness(selectedDevice) && selectedDevice.brightness !== null && (
              <div className={`p-3 rounded-lg ${dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <Sun size={16} className="text-yellow-400" /> Brightness
                  </span>
                  <span className="text-neutral-400">
                    {brightnessMutation.isPending ? '...' : `${selectedDevice.brightness}%`}
                  </span>
                </div>
                {mutationError && mutationError.includes('brightness') && (
                  <div className="text-xs text-red-400 mb-2">{mutationError}</div>
                )}
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={selectedDevice.brightness}
                  onChange={(e) =>
                    setSelectedDevice({
                      ...selectedDevice,
                      brightness: parseInt(e.target.value, 10),
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
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-600"
                  disabled={!selectedDevice.on}
                />
              </div>
            )}

            {/* Energy */}
            {selectedDevice.has_emeter && (
              <div className={`p-3 rounded-lg ${dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}>
                <div className="font-medium flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-yellow-400" /> Energy
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-neutral-400">Current</span>
                    <div className="font-medium">
                      {selectedDevice.power_watts?.toFixed(1) ?? '--'} W
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400">Today</span>
                    <div className="font-medium">
                      {selectedDevice.energy_today_kwh?.toFixed(2) ?? '--'} kWh
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Countdown Timer */}
            <div className={`p-3 rounded-lg ${dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}>
              <div className="font-medium flex items-center gap-2 mb-2">
                <Timer size={16} className="text-blue-400" /> Turn Off Timer
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={countdownMins}
                  onChange={(e) => setCountdownMins(parseInt(e.target.value, 10))}
                  className={`flex-1 px-2 py-1 rounded text-sm ${dark ? 'bg-neutral-600' : 'bg-neutral-300'}`}
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
                      action: 'off',
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
                <div className="text-xs text-green-400 mt-1">
                  Timer set for {countdownMins} minutes
                </div>
              )}
              {countdownStatus === 'error' && (
                <div className="text-xs text-red-400 mt-1">{mutationError}</div>
              )}
            </div>

            {/* Schedules */}
            <div className={`p-3 rounded-lg ${dark ? 'bg-neutral-700/30' : 'bg-neutral-200/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium flex items-center gap-2">
                  <Calendar size={16} className="text-purple-400" /> Schedules
                </span>
                <Button
                  onClick={() => {
                    setEditingRule(null);
                    setScheduleForm({
                      action: 'on',
                      time: '07:00',
                      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
                    });
                    setShowScheduleForm(true);
                  }}
                >
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>

              {scheduleLoading ? (
                <div className="text-sm text-neutral-500">Loading schedules...</div>
              ) : scheduleData?.rules && scheduleData.rules.length > 0 ? (
                <div className="space-y-2">
                  {scheduleData.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-center justify-between p-2 rounded ${
                        dark ? 'bg-neutral-600/50' : 'bg-neutral-300/50'
                      } ${!rule.enabled ? 'opacity-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              rule.action === 'on'
                                ? 'bg-green-500/30 text-green-400'
                                : 'bg-red-500/30 text-red-400'
                            }`}
                          >
                            {rule.action.toUpperCase()}
                          </span>
                          <span className="font-medium">{rule.time}</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {rule.days
                            .map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3))
                            .join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            scheduleMutation.mutate({
                              type: 'toggle',
                              ip: selectedDevice.ip,
                              ruleId: rule.id,
                              enabled: !rule.enabled,
                            })
                          }
                          className={`w-8 h-4 rounded-full transition-colors ${
                            rule.enabled ? 'bg-green-500' : 'bg-neutral-500'
                          }`}
                          title={rule.enabled ? 'Disable' : 'Enable'}
                        >
                          <div
                            className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                              rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setScheduleForm({
                              action: rule.action as 'on' | 'off',
                              time: rule.time,
                              days: rule.days,
                            });
                            setShowScheduleForm(true);
                          }}
                          className="p-1 rounded hover:bg-neutral-500/50"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteRule(rule)}
                          className="p-1 rounded hover:bg-red-500/50"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500">No schedules configured</div>
              )}
            </div>

            {/* Device Info */}
            <div className="text-xs text-neutral-500 space-y-1">
              <div>Model: {selectedDevice.model}</div>
              <div>IP: {selectedDevice.ip}</div>
              {selectedDevice.features.length > 0 && (
                <div>Features: {selectedDevice.features.join(', ')}</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule Form Modal */}
      <Modal
        open={showScheduleForm}
        onClose={() => {
          setShowScheduleForm(false);
          setEditingRule(null);
        }}
        title={editingRule ? 'Edit Schedule' : 'Add Schedule'}
        actions={
          <>
            <Button
              onClick={() => {
                setShowScheduleForm(false);
                setEditingRule(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (selectedDevice) {
                  if (editingRule) {
                    scheduleMutation.mutate({
                      type: 'update',
                      ip: selectedDevice.ip,
                      ruleId: editingRule.id,
                      action: scheduleForm.action,
                      time: scheduleForm.time,
                      days: scheduleForm.days,
                    });
                  } else {
                    scheduleMutation.mutate({
                      type: 'add',
                      ip: selectedDevice.ip,
                      action: scheduleForm.action,
                      time: scheduleForm.time,
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
              <button
                onClick={() => setScheduleForm((f) => ({ ...f, action: 'on' }))}
                className={`flex-1 py-2 rounded font-medium ${
                  scheduleForm.action === 'on'
                    ? 'bg-green-500 text-white'
                    : dark
                      ? 'bg-neutral-700 text-neutral-300'
                      : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                Turn On
              </button>
              <button
                onClick={() => setScheduleForm((f) => ({ ...f, action: 'off' }))}
                className={`flex-1 py-2 rounded font-medium ${
                  scheduleForm.action === 'off'
                    ? 'bg-red-500 text-white'
                    : dark
                      ? 'bg-neutral-700 text-neutral-300'
                      : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                Turn Off
              </button>
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium mb-1">Time</label>
            <TimePickerCompact
              value={scheduleForm.time}
              onChange={(time) => setScheduleForm((f) => ({ ...f, time }))}
            />
          </div>

          {/* Days */}
          <div>
            <label className="block text-sm font-medium mb-1">Days</label>
            <div className="flex gap-1">
              {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((day) => (
                <button
                  key={day}
                  onClick={() =>
                    setScheduleForm((f) => ({
                      ...f,
                      days: f.days.includes(day)
                        ? f.days.filter((d) => d !== day)
                        : [...f.days, day],
                    }))
                  }
                  className={`w-9 h-9 rounded text-sm font-medium ${
                    scheduleForm.days.includes(day)
                      ? 'bg-blue-500 text-white'
                      : dark
                        ? 'bg-neutral-700 text-neutral-400'
                        : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {day.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
            {scheduleForm.days.length === 0 && (
              <div className="text-xs text-red-400 mt-1">Select at least one day</div>
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
