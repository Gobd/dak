import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { Spinner } from '@dak/ui';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import { client, listDevicesMqttDevicesGet, type DeviceListResponse } from '@dak/api-client';

async function fetchDevices(): Promise<DeviceListResponse> {
  client.setConfig({ baseUrl: getRelayUrl() });
  const result = await listDevicesMqttDevicesGet({ throwOnError: true });
  return result.data;
}

export default function Mqtt() {
  const setShowModal = useConfigStore((s) => s.setMqttModalOpen);

  const { data, isLoading } = useQuery({
    queryKey: ['mqtt-devices'],
    queryFn: fetchDevices,
    refetchInterval: 30_000,
    staleTime: 3000,
  });

  const devices = data?.devices.filter((d) => d.type !== 'Coordinator') ?? [];
  const permitJoin = data?.permit_join ?? false;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <button
        onClick={() => setShowModal(true)}
        className="relative p-2 rounded-lg transition-colors hover:bg-surface-sunken/40"
        title={`Zigbee Devices${devices.length > 0 ? ` (${devices.length})` : ''}`}
      >
        <Radio
          size={24}
          className={permitJoin ? 'text-success animate-pulse' : 'text-text-muted'}
        />
        {isLoading && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
        {devices.length > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[9px] px-1 rounded bg-surface-sunken">
            {devices.length}
          </span>
        )}
      </button>
    </div>
  );
}
