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
import { Spinner, Button, TimePickerCompact, Card, Toggle } from '@dak/ui';
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
        old?.map((d) => (d.ip === device.ip ? { ...d, on: !d.on } : d)),
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
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-danger" />
        <p className="text-text-secondary">
          {error instanceof Error ? error.message : 'Failed to load devices'}
        </p>
        <p className="text-text-muted text-sm">Relay: {relayUrl}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  // Empty state
  if (!devices?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wifi className="w-12 h-12 text-text-muted" />
        <p className="text-text-secondary">No devices found</p>
        <Button onClick={() => refetch()}>Scan Again</Button>
      </div>
    );
  }

  // Device Detail View
  if (selectedDevice) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button onClick={() => setSelectedDevice(null)} variant="secondary" size="sm">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold flex-1 text-text">{selectedDevice.name}</h2>
        </div>

        {/* Power Control */}
        <div
          className={`p-4 rounded-xl ${
            selectedDevice.on
              ? 'bg-success/20 border border-success/50'
              : 'bg-surface-raised border border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-text">Power</span>
            <Button
              variant={selectedDevice.on ? 'primary' : 'secondary'}
              onClick={() => {
                toggleMutation.mutate(selectedDevice);
                setSelectedDevice({ ...selectedDevice, on: !selectedDevice.on });
              }}
              className={selectedDevice.on ? 'bg-success hover:bg-success-hover' : ''}
            >
              {selectedDevice.on ? 'ON' : 'OFF'}
            </Button>
          </div>
          {selectedDevice.on && selectedDevice.on_since && (
            <div className="text-sm text-text-secondary mt-2 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              On for {formatDuration(selectedDevice.on_since)}
            </div>
          )}
        </div>

        {/* Brightness */}
        {hasBrightness(selectedDevice) && selectedDevice.brightness !== null && (
          <Card className="border border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium flex items-center gap-2 text-text">
                <Sun className="w-5 h-5 text-warning" />
                Brightness
              </span>
              <span className="text-text-secondary">
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
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-surface-sunken"
              disabled={!selectedDevice.on}
            />
          </Card>
        )}

        {/* Energy */}
        {selectedDevice.has_emeter && (
          <Card className="border border-border">
            <div className="font-medium flex items-center gap-2 mb-3 text-text">
              <Zap className="w-5 h-5 text-warning" />
              Energy
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-text-secondary text-sm">Current</span>
                <div className="font-medium text-lg text-text">
                  {selectedDevice.power_watts?.toFixed(1) ?? '--'} W
                </div>
              </div>
              <div>
                <span className="text-text-secondary text-sm">Today</span>
                <div className="font-medium text-lg text-text">
                  {selectedDevice.energy_today_kwh?.toFixed(2) ?? '--'} kWh
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Countdown Timer */}
        <Card className="border border-border">
          <div className="font-medium flex items-center gap-2 mb-3 text-text">
            <Timer className="w-5 h-5 text-accent" />
            Turn Off Timer
          </div>
          <div className="flex items-center gap-3">
            <select
              value={countdownMins}
              onChange={(e) => setCountdownMins(parseInt(e.target.value, 10))}
              className="flex-1 px-3 py-2 rounded-lg bg-surface-sunken border border-border text-text"
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
              loading={countdownMutation.isPending}
            >
              {countdownStatus === 'success' ? 'Set!' : 'Set'}
            </Button>
          </div>
          {countdownStatus === 'success' && (
            <div className="text-sm text-success mt-2">Timer set for {countdownMins} minutes</div>
          )}
          {countdownStatus === 'error' && (
            <div className="text-sm text-danger mt-2">Device may not support timers</div>
          )}
        </Card>

        {/* Schedules */}
        <Card className="border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium flex items-center gap-2 text-text">
              <Calendar className="w-5 h-5 text-accent" />
              Schedules
            </span>
            <Button
              variant="secondary"
              size="sm"
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
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          {scheduleLoading ? (
            <div className="text-sm text-text-muted">Loading schedules...</div>
          ) : scheduleData?.rules && scheduleData.rules.length > 0 ? (
            <div className="space-y-2">
              {scheduleData.rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-3 rounded-lg bg-surface-sunken ${
                    !rule.enabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          rule.action === 'on'
                            ? 'bg-success/30 text-success'
                            : 'bg-danger/30 text-danger'
                        }`}
                      >
                        {rule.action.toUpperCase()}
                      </span>
                      <span className="font-medium text-text">{rule.time}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {rule.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
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
                        setScheduleForm({
                          action: rule.action as 'on' | 'off',
                          time: rule.time,
                          days: rule.days,
                        });
                        setShowScheduleForm(true);
                      }}
                      className="text-text-secondary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteConfirm(rule)}
                      className="text-danger hover:bg-danger/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-muted">No schedules configured</div>
          )}
        </Card>

        {/* Device Info */}
        <div className="text-sm text-text-muted space-y-1">
          <div>Model: {selectedDevice.model}</div>
          <div>IP: {selectedDevice.ip}</div>
          {selectedDevice.features && selectedDevice.features.length > 0 && (
            <div>Features: {selectedDevice.features.join(', ')}</div>
          )}
        </div>

        {/* Schedule Form Modal */}
        {showScheduleForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card padding="lg" className="w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4 text-text">
                {editingRule ? 'Edit Schedule' : 'Add Schedule'}
              </h3>

              <div className="space-y-4">
                {/* Action */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-text">Action</label>
                  <div className="flex gap-2">
                    <Button
                      variant={scheduleForm.action === 'on' ? 'primary' : 'secondary'}
                      onClick={() => setScheduleForm((f) => ({ ...f, action: 'on' }))}
                      className={`flex-1 ${scheduleForm.action === 'on' ? 'bg-success hover:bg-success-hover' : ''}`}
                    >
                      Turn On
                    </Button>
                    <Button
                      variant={scheduleForm.action === 'off' ? 'danger' : 'secondary'}
                      onClick={() => setScheduleForm((f) => ({ ...f, action: 'off' }))}
                      className="flex-1"
                    >
                      Turn Off
                    </Button>
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-text">Time</label>
                  <TimePickerCompact
                    value={scheduleForm.time}
                    onChange={(time) => setScheduleForm((f) => ({ ...f, time }))}
                  />
                </div>

                {/* Days */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-text">Days</label>
                  <div className="flex gap-1">
                    {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((day) => (
                      <Button
                        key={day}
                        variant={scheduleForm.days.includes(day) ? 'primary' : 'secondary'}
                        onClick={() =>
                          setScheduleForm((f) => ({
                            ...f,
                            days: f.days.includes(day)
                              ? f.days.filter((d) => d !== day)
                              : [...f.days, day],
                          }))
                        }
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

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowScheduleForm(false);
                    setEditingRule(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
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
                  className="flex-1"
                >
                  {scheduleMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card padding="lg" className="w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-2 text-text">Delete Schedule</h3>
              <p className="text-text-secondary mb-4">
                Delete this schedule ({deleteConfirm.action.toUpperCase()} at {deleteConfirm.time})?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    scheduleMutation.mutate({
                      type: 'delete',
                      ip: selectedDevice.ip,
                      ruleId: deleteConfirm.id,
                    })
                  }
                  disabled={scheduleMutation.isPending}
                  className="flex-1"
                >
                  {scheduleMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Device List View
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <span className="text-text-secondary text-sm">
          {devices.length} device{devices.length !== 1 && 's'}
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh devices"
        >
          {isFetching ? <Spinner size="sm" /> : <RefreshCw className="w-5 h-5" />}
        </Button>
      </div>

      {[...devices]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((device) => (
          <div
            key={device.ip}
            className={`p-4 rounded-xl flex items-center gap-4 transition-all ${
              device.on
                ? 'bg-success/20 border border-success/50'
                : 'bg-surface-raised border border-border'
            }`}
          >
            <Button
              variant={device.on ? 'primary' : 'secondary'}
              size="icon"
              rounded
              onClick={() => toggleMutation.mutate(device)}
              disabled={toggleMutation.isPending}
              className={`p-3 ${device.on ? 'bg-success hover:bg-success-hover' : ''}`}
            >
              <Power className={`w-6 h-6 ${device.on ? '' : 'text-text-secondary'}`} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSelectedDevice(device)}
              className="flex-1 text-left justify-start h-auto py-0"
            >
              <div>
                <p className="font-medium text-text">{device.name}</p>
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <span>{device.model}</span>
                  {device.on && device.on_since && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(device.on_since)}
                    </span>
                  )}
                  {device.has_emeter && device.power_watts != null && device.on && (
                    <span className="flex items-center gap-1 text-warning">
                      <Zap className="w-3 h-3" />
                      {device.power_watts.toFixed(1)}W
                    </span>
                  )}
                </div>
              </div>
            </Button>
            <span
              className={`text-sm font-medium ${device.on ? 'text-success' : 'text-text-muted'}`}
            >
              {device.on ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
    </div>
  );
}
