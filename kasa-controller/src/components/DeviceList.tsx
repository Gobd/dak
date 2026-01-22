import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Power,
  RefreshCw,
  AlertCircle,
  Wifi,
  Sun,
  Clock,
  Zap,
  Timer,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';
import {
  createKasaClient,
  hasBrightness,
  formatDuration,
  type KasaDevice,
  type ScheduleRule,
} from '@dak/kasa-client';

export default function DeviceList() {
  const relayUrl = useSettingsStore((s) => s.relayUrl);
  const queryClient = useQueryClient();
  const client = useMemo(() => createKasaClient(relayUrl), [relayUrl]);

  // Device detail state
  const [selectedDevice, setSelectedDevice] = useState<KasaDevice | null>(null);
  const [countdownMins, setCountdownMins] = useState(30);
  const [countdownStatus, setCountdownStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Schedule state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ScheduleRule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    action: 'on' as 'on' | 'off',
    time: '07:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
  });

  const {
    data: devices,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<KasaDevice[]>({
    queryKey: ['kasa-devices', relayUrl],
    queryFn: async () => {
      const healthy = await client.checkHealth();
      if (!healthy) throw new Error('Relay offline');
      return client.discoverDevices();
    },
    refetchInterval: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: (device: KasaDevice) => client.toggleDevice(device.ip),
    onMutate: async (device) => {
      await queryClient.cancelQueries({ queryKey: ['kasa-devices', relayUrl] });
      const previous = queryClient.getQueryData<KasaDevice[]>(['kasa-devices', relayUrl]);
      queryClient.setQueryData<KasaDevice[]>(['kasa-devices', relayUrl], (old) =>
        old?.map((d) => (d.ip === device.ip ? { ...d, on: !d.on } : d))
      );
      return { previous };
    },
    onError: (_err, _device, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['kasa-devices', relayUrl], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kasa-devices', relayUrl] });
    },
  });

  const brightnessMutation = useMutation({
    mutationFn: ({ ip, brightness }: { ip: string; brightness: number }) =>
      client.setBrightness(ip, brightness),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasa-devices', relayUrl] });
    },
  });

  const countdownMutation = useMutation({
    mutationFn: ({ ip, minutes, action }: { ip: string; minutes: number; action: 'on' | 'off' }) =>
      client.setCountdown(ip, minutes, action),
    onSuccess: (success) => {
      if (success) {
        setCountdownStatus('success');
        setTimeout(() => setCountdownStatus('idle'), 3000);
      } else {
        setCountdownStatus('error');
        setTimeout(() => setCountdownStatus('idle'), 3000);
      }
    },
  });

  // Schedule query
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
      setDeleteConfirm(null);
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-slate-400">
          {error instanceof Error ? error.message : 'Failed to load devices'}
        </p>
        <p className="text-slate-500 text-sm">Relay: {relayUrl}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (!devices?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wifi className="w-12 h-12 text-slate-500" />
        <p className="text-slate-400">No devices found</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Scan Again
        </button>
      </div>
    );
  }

  // Device Detail View
  if (selectedDevice) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDevice(null)}
            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold flex-1">{selectedDevice.name}</h2>
        </div>

        {/* Power Control */}
        <div
          className={`p-4 rounded-xl ${
            selectedDevice.on
              ? 'bg-green-900/50 border border-green-700'
              : 'bg-slate-800 border border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">Power</span>
            <button
              onClick={() => {
                toggleMutation.mutate(selectedDevice);
                setSelectedDevice({ ...selectedDevice, on: !selectedDevice.on });
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                selectedDevice.on
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              {selectedDevice.on ? 'ON' : 'OFF'}
            </button>
          </div>
          {selectedDevice.on && selectedDevice.on_since && (
            <div className="text-sm text-slate-400 mt-2 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              On for {formatDuration(selectedDevice.on_since)}
            </div>
          )}
        </div>

        {/* Brightness */}
        {hasBrightness(selectedDevice) && selectedDevice.brightness !== null && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-400" />
                Brightness
              </span>
              <span className="text-slate-400">
                {brightnessMutation.isPending ? '...' : `${selectedDevice.brightness}%`}
              </span>
            </div>
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
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-600"
              disabled={!selectedDevice.on}
            />
          </div>
        )}

        {/* Energy */}
        {selectedDevice.has_emeter && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <div className="font-medium flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              Energy
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 text-sm">Current</span>
                <div className="font-medium text-lg">
                  {selectedDevice.power_watts?.toFixed(1) ?? '--'} W
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Today</span>
                <div className="font-medium text-lg">
                  {selectedDevice.energy_today_kwh?.toFixed(2) ?? '--'} kWh
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <div className="font-medium flex items-center gap-2 mb-3">
            <Timer className="w-5 h-5 text-blue-400" />
            Turn Off Timer
          </div>
          <div className="flex items-center gap-3">
            <select
              value={countdownMins}
              onChange={(e) => setCountdownMins(parseInt(e.target.value, 10))}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
            </select>
            <button
              onClick={() =>
                countdownMutation.mutate({
                  ip: selectedDevice.ip,
                  minutes: countdownMins,
                  action: 'off',
                })
              }
              disabled={countdownMutation.isPending}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {countdownMutation.isPending
                ? 'Setting...'
                : countdownStatus === 'success'
                  ? 'Set!'
                  : 'Set'}
            </button>
          </div>
          {countdownStatus === 'success' && (
            <div className="text-sm text-green-400 mt-2">Timer set for {countdownMins} minutes</div>
          )}
          {countdownStatus === 'error' && (
            <div className="text-sm text-red-400 mt-2">Device may not support timers</div>
          )}
        </div>

        {/* Schedules */}
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Schedules
            </span>
            <button
              onClick={() => {
                setEditingRule(null);
                setScheduleForm({
                  action: 'on',
                  time: '07:00',
                  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
                });
                setShowScheduleForm(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 rounded-lg hover:bg-slate-600"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {scheduleLoading ? (
            <div className="text-sm text-slate-500">Loading schedules...</div>
          ) : scheduleData?.rules && scheduleData.rules.length > 0 ? (
            <div className="space-y-2">
              {scheduleData.rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-3 rounded-lg bg-slate-700/50 ${
                    !rule.enabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          rule.action === 'on'
                            ? 'bg-green-500/30 text-green-400'
                            : 'bg-red-500/30 text-red-400'
                        }`}
                      >
                        {rule.action.toUpperCase()}
                      </span>
                      <span className="font-medium">{rule.time}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {rule.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        scheduleMutation.mutate({
                          type: 'toggle',
                          ip: selectedDevice.ip,
                          ruleId: rule.id,
                          enabled: !rule.enabled,
                        })
                      }
                      className={`w-10 h-5 rounded-full transition-colors ${
                        rule.enabled ? 'bg-green-500' : 'bg-slate-500'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                          rule.enabled ? 'translate-x-5' : 'translate-x-0.5'
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
                      className="p-1.5 rounded hover:bg-slate-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(rule)}
                      className="p-1.5 rounded hover:bg-red-500/30"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No schedules configured</div>
          )}
        </div>

        {/* Device Info */}
        <div className="text-sm text-slate-500 space-y-1">
          <div>Model: {selectedDevice.model}</div>
          <div>IP: {selectedDevice.ip}</div>
          {selectedDevice.features.length > 0 && (
            <div>Features: {selectedDevice.features.join(', ')}</div>
          )}
        </div>

        {/* Schedule Form Modal */}
        {showScheduleForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {editingRule ? 'Edit Schedule' : 'Add Schedule'}
              </h3>

              <div className="space-y-4">
                {/* Action */}
                <div>
                  <label className="block text-sm font-medium mb-2">Action</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setScheduleForm((f) => ({ ...f, action: 'on' }))}
                      className={`flex-1 py-2 rounded-lg font-medium ${
                        scheduleForm.action === 'on'
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Turn On
                    </button>
                    <button
                      onClick={() => setScheduleForm((f) => ({ ...f, action: 'off' }))}
                      className={`flex-1 py-2 rounded-lg font-medium ${
                        scheduleForm.action === 'off'
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Turn Off
                    </button>
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium mb-2">Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600"
                  />
                </div>

                {/* Days */}
                <div>
                  <label className="block text-sm font-medium mb-2">Days</label>
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
                        className={`w-9 h-9 rounded-lg text-sm font-medium ${
                          scheduleForm.days.includes(day)
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-700 text-slate-400'
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

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowScheduleForm(false);
                    setEditingRule(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
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
                  }}
                  disabled={scheduleMutation.isPending || scheduleForm.days.length === 0}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {scheduleMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl p-5 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-2">Delete Schedule</h3>
              <p className="text-slate-400 mb-4">
                Delete this schedule ({deleteConfirm.action.toUpperCase()} at {deleteConfirm.time})?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    scheduleMutation.mutate({
                      type: 'delete',
                      ip: selectedDevice.ip,
                      ruleId: deleteConfirm.id,
                    })
                  }
                  disabled={scheduleMutation.isPending}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {scheduleMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Device List View
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm">
          {devices.length} device{devices.length !== 1 && 's'}
        </span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          aria-label="Refresh devices"
        >
          <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {[...devices]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((device) => (
          <div
            key={device.ip}
            className={`p-4 rounded-xl flex items-center gap-4 transition-all ${
              device.on
                ? 'bg-green-900/50 border border-green-700'
                : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <button
              onClick={() => toggleMutation.mutate(device)}
              disabled={toggleMutation.isPending}
              className={`p-3 rounded-full ${
                device.on ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              <Power className="w-6 h-6" />
            </button>
            <button
              onClick={() => setSelectedDevice(device)}
              className="flex-1 text-left hover:opacity-80"
            >
              <p className="font-medium">{device.name}</p>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span>{device.model}</span>
                {device.on && device.on_since && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(device.on_since)}
                  </span>
                )}
                {device.has_emeter && device.power_watts !== null && device.on && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Zap className="w-3 h-3" />
                    {device.power_watts.toFixed(1)}W
                  </span>
                )}
              </div>
            </button>
            <span
              className={`text-sm font-medium ${device.on ? 'text-green-400' : 'text-slate-500'}`}
            >
              {device.on ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
    </div>
  );
}
