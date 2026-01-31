import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Thermometer,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Settings as SettingsIcon,
  Home,
  Sun,
  Moon,
} from 'lucide-react';
import { useDarkMode } from '@dak/hooks';
import { Spinner, Button } from '@dak/ui';
import { useSettingsStore } from './stores/settings-store';
import Settings from './components/Settings';

interface SensorData {
  available: boolean;
  temperature: number;
  humidity: number;
  feels_like: number;
  temperature_trend: 'rising' | 'falling' | 'steady';
  humidity_trend: 'rising' | 'falling' | 'steady';
  battery: number;
  error?: string;
}

interface ClimateData {
  indoor: SensorData;
  outdoor: SensorData;
  comparison: {
    outside_feels_cooler: boolean;
    outside_feels_warmer: boolean;
    difference: number;
  } | null;
}

type View = 'climate' | 'settings';

function TrendIcon({ trend }: { trend: 'rising' | 'falling' | 'steady' }) {
  if (trend === 'rising') return <TrendingUp className="w-5 h-5 text-danger" />;
  if (trend === 'falling') return <TrendingDown className="w-5 h-5 text-accent" />;
  return <Minus className="w-5 h-5 text-text-muted" />;
}

function SensorCard({
  label,
  icon,
  sensor,
}: {
  label: string;
  icon: string;
  sensor: SensorData | undefined;
}) {
  if (!sensor?.available) {
    return (
      <div className="bg-surface-raised rounded-2xl p-6 flex flex-col items-center justify-center min-h-[200px] border border-border">
        <span className="text-5xl mb-3">{icon}</span>
        <span className="text-text-secondary text-lg">{label}</span>
        <span className="text-warning text-sm mt-2">{sensor?.error || 'No data'}</span>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-2xl p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <span className="text-4xl">{icon}</span>
        <span className="text-text-secondary font-medium">{label}</span>
      </div>

      <div className="space-y-5">
        {/* Temperature */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Thermometer className="w-6 h-6 text-warning" />
            <span className="text-4xl font-light text-text">{sensor.temperature.toFixed(1)}°</span>
          </div>
          <TrendIcon trend={sensor.temperature_trend} />
        </div>

        {/* Humidity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="w-6 h-6 text-accent" />
            <span className="text-2xl font-light text-text">{Math.round(sensor.humidity)}%</span>
          </div>
          <TrendIcon trend={sensor.humidity_trend} />
        </div>

        {/* Feels like */}
        <div className="pt-3 border-t border-border">
          <span className="text-text-muted text-sm">
            Feels like {sensor.feels_like.toFixed(1)}°
          </span>
        </div>

        {/* Battery warning */}
        {sensor.battery < 20 && (
          <div className="text-warning text-sm flex items-center gap-2">
            <span>⚠️</span> Battery low ({sensor.battery}%)
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonBanner({ comparison }: { comparison: ClimateData['comparison'] }) {
  if (!comparison) return null;

  const { outside_feels_cooler, outside_feels_warmer, difference } = comparison;
  const absDiff = Math.abs(difference).toFixed(1);

  if (!outside_feels_cooler && !outside_feels_warmer) {
    return (
      <div className="bg-surface-raised rounded-2xl p-8 text-center border border-border">
        <span className="text-4xl mb-3 block">⚖️</span>
        <span className="text-text-secondary text-xl">About the same</span>
        <p className="text-text-muted text-sm mt-2">Inside and outside feel similar</p>
      </div>
    );
  }

  if (outside_feels_cooler) {
    return (
      <div className="bg-gradient-to-br from-blue-900/80 to-cyan-900/80 backdrop-blur rounded-2xl p-8 text-center border border-info">
        <span className="text-5xl mb-3 block">❄️</span>
        <span className="text-info text-2xl font-medium">Outside is {absDiff}° cooler</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-900/80 to-red-900/80 backdrop-blur rounded-2xl p-8 text-center border border-warning">
      <span className="text-5xl mb-3 block">🔥</span>
      <span className="text-warning text-2xl font-medium">Outside is {absDiff}° warmer</span>
    </div>
  );
}

function ClimateView() {
  const relayUrl = useSettingsStore((s) => s.relayUrl);

  const { data, isLoading, error, refetch, isFetching } = useQuery<ClimateData>({
    queryKey: ['climate', relayUrl],
    queryFn: async () => {
      const res = await fetch(`${relayUrl}/sensors/all`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-danger-light backdrop-blur rounded-2xl p-8 text-center border border-danger/30 max-w-sm">
          <span className="text-4xl mb-3 block">⚠️</span>
          <span className="text-danger text-lg">Failed to load climate data</span>
          <p className="text-danger/70 text-sm mt-2">Check relay URL in settings</p>
          <Button onClick={() => refetch()} variant="danger" size="sm" className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Refresh button */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh"
        >
          {isFetching ? <Spinner size="sm" /> : <RefreshCw className="w-5 h-5" />}
        </Button>
      </div>

      {/* Sensor cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SensorCard label="Indoor" icon="🏠" sensor={data?.indoor} />
        <SensorCard label="Outdoor" icon="🌳" sensor={data?.outdoor} />
      </div>

      {/* Comparison */}
      {data?.indoor?.available && data?.outdoor?.available && (
        <ComparisonBanner comparison={data.comparison} />
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('climate');
  const [isDark, setIsDark] = useDarkMode('climate-dark-mode');

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <header className="bg-surface-raised border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Climate</h1>
        <nav className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button
            variant={view === 'climate' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setView('climate')}
            aria-label="Climate"
          >
            <Home className="w-5 h-5" />
          </Button>
          <Button
            variant={view === 'settings' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setView('settings')}
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </nav>
      </header>

      {view === 'climate' ? (
        <ClimateView />
      ) : (
        <main className="flex-1 p-6">
          <Settings />
        </main>
      )}
    </div>
  );
}
