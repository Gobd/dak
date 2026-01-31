import { useQuery } from '@tanstack/react-query';
import { Server } from 'lucide-react';
import { useToggle } from '@dak/hooks';
import { getRelayUrl } from '../../stores/config-store';
import { Modal, Button, Spinner } from '@dak/ui';
import { client, getSystemStatsSystemStatsGet } from '@dak/api-client';
import type { WidgetComponentProps } from './index';

interface SystemStats {
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  disks: Array<{ path: string; percent: number; free_gb: number }>;
  uptime_seconds: number;
}

async function fetchStats(): Promise<SystemStats> {
  client.setConfig({ baseUrl: getRelayUrl() });
  const result = await getSystemStatsSystemStatsGet({ throwOnError: true });
  return result.data as SystemStats;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getHealthColor(percent: number): string {
  if (percent >= 90) return 'text-danger';
  if (percent >= 75) return 'text-warning';
  return 'text-success';
}

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-danger';
  if (percent >= 75) return 'bg-warning';
  return 'bg-success';
}

function StatBar({ label, percent, detail }: { label: string; percent: number; detail?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text">
          {percent.toFixed(0)}%{detail && <span className="text-text-muted ml-1">({detail})</span>}
        </span>
      </div>
      <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function IconMode({
  data,
  isLoading,
  showModal,
}: {
  data?: SystemStats;
  isLoading: boolean;
  showModal: { value: boolean; setTrue: () => void; setFalse: () => void };
}) {
  // Determine health status based on worst metric
  const worstPercent = data
    ? Math.max(data.cpu_percent, data.memory_percent, ...data.disks.map((d) => d.percent))
    : 0;

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => showModal.setTrue()}
        title="System Stats"
        className="relative"
      >
        <Server size={24} className={data ? getHealthColor(worstPercent) : 'text-text-muted'} />
        {isLoading && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
      </Button>

      <Modal
        open={showModal.value}
        onClose={() => showModal.setFalse()}
        title="System Stats"
        actions={<Button onClick={() => showModal.setFalse()}>Close</Button>}
      >
        {data ? (
          <div className="space-y-4">
            <StatBar label="CPU" percent={data.cpu_percent} />
            <StatBar
              label="RAM"
              percent={data.memory_percent}
              detail={`${data.memory_used_gb} / ${data.memory_total_gb} GB`}
            />
            {data.disks.map((disk) => (
              <StatBar
                key={disk.path}
                label={`Disk ${disk.path}`}
                percent={disk.percent}
                detail={`${disk.free_gb.toFixed(0)} GB free`}
              />
            ))}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Uptime</span>
                <span className="text-text">{formatUptime(data.uptime_seconds)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-text-muted">
            {isLoading ? 'Loading...' : 'Unable to fetch stats'}
          </div>
        )}
      </Modal>
    </div>
  );
}

function InlineMode({ data, isLoading }: { data?: SystemStats; isLoading: boolean }) {
  if (isLoading && !data) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
        Offline
      </div>
    );
  }

  // Show CPU, RAM, and first disk
  const primaryDisk = data.disks[0];

  return (
    <div className="w-full h-full p-3 flex flex-col justify-center gap-2">
      <StatBar label="CPU" percent={data.cpu_percent} />
      <StatBar label="RAM" percent={data.memory_percent} />
      {primaryDisk && <StatBar label="Disk" percent={primaryDisk.percent} />}
    </div>
  );
}

export default function SystemStats({ panel }: WidgetComponentProps) {
  const mode = (panel.args?.mode as 'icon' | 'inline') ?? 'icon';
  const showModal = useToggle(false);

  const { data, isLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: fetchStats,
    refetchInterval: 10_000,
    retry: false,
  });

  if (mode === 'inline') {
    return <InlineMode data={data} isLoading={isLoading} />;
  }

  return <IconMode data={data} isLoading={isLoading} showModal={showModal} />;
}
