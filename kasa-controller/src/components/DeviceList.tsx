import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, RefreshCw, AlertCircle, Wifi } from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';

interface KasaDevice {
  ip: string;
  name: string;
  on: boolean;
  model: string;
  type: string;
}

export default function DeviceList() {
  const relayUrl = useSettingsStore((s) => s.relayUrl);
  const queryClient = useQueryClient();

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
      const res = await fetch(`${relayUrl}/kasa/discover`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to discover devices');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (device: KasaDevice) => {
      const res = await fetch(`${relayUrl}/kasa/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: device.ip }),
      });
      if (!res.ok) throw new Error('Failed to toggle device');
      return res.json();
    },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

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
        <button
          key={device.ip}
          onClick={() => toggleMutation.mutate(device)}
          disabled={toggleMutation.isPending}
          className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${
            device.on
              ? 'bg-green-900/50 border border-green-700'
              : 'bg-slate-800 border border-slate-700'
          } hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70`}
        >
          <div className={`p-3 rounded-full ${device.on ? 'bg-green-600' : 'bg-slate-600'}`}>
            <Power className="w-6 h-6" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium">{device.name}</p>
            <p className="text-sm text-slate-400">{device.model}</p>
          </div>
          <span
            className={`text-sm font-medium ${device.on ? 'text-green-400' : 'text-slate-500'}`}
          >
            {device.on ? 'ON' : 'OFF'}
          </span>
        </button>
      ))}
    </div>
  );
}
