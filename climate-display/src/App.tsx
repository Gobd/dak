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
} from 'lucide-react';
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
  if (trend === 'rising') return <TrendingUp className="w-5 h-5 text-red-400" />;
  if (trend === 'falling') return <TrendingDown className="w-5 h-5 text-blue-400" />;
  return <Minus className="w-5 h-5 text-slate-500" />;
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
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 flex flex-col items-center justify-center min-h-[200px] border border-slate-700/50">
        <span className="text-5xl mb-3">{icon}</span>
        <span className="text-slate-400 text-lg">{label}</span>
        <span className="text-slate-600 text-sm mt-2">No data</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <span className="text-4xl">{icon}</span>
        <span className="text-slate-400 font-medium">{label}</span>
      </div>

      <div className="space-y-5">
        {/* Temperature */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Thermometer className="w-6 h-6 text-orange-400" />
            <span className="text-4xl font-light">{Math.round(sensor.temperature)}°</span>
          </div>
          <TrendIcon trend={sensor.temperature_trend} />
        </div>

        {/* Humidity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="w-6 h-6 text-blue-400" />
            <span className="text-2xl font-light">{Math.round(sensor.humidity)}%</span>
          </div>
          <TrendIcon trend={sensor.humidity_trend} />
        </div>

        {/* Feels like */}
        <div className="pt-3 border-t border-slate-700/50">
          <span className="text-slate-500 text-sm">
            Feels like {Math.round(sensor.feels_like)}°
          </span>
        </div>

        {/* Battery warning */}
        {sensor.battery < 20 && (
          <div className="text-yellow-500 text-sm flex items-center gap-2">
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
  const absDiff = Math.abs(difference);

  if (!outside_feels_cooler && !outside_feels_warmer) {
    return (
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 text-center border border-slate-700/50">
        <span className="text-4xl mb-3 block">⚖️</span>
        <span className="text-slate-300 text-xl">About the same</span>
        <p className="text-slate-500 text-sm mt-2">Inside and outside feel similar</p>
      </div>
    );
  }

  if (outside_feels_cooler) {
    return (
      <div className="bg-gradient-to-br from-blue-900/80 to-cyan-900/80 backdrop-blur rounded-2xl p-8 text-center border border-blue-700/30">
        <span className="text-5xl mb-3 block">❄️</span>
        <span className="text-blue-100 text-2xl font-medium">Outside is {absDiff}° cooler</span>
        <p className="text-blue-300/70 text-sm mt-2">Good time to open windows</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-900/80 to-red-900/80 backdrop-blur rounded-2xl p-8 text-center border border-orange-700/30">
      <span className="text-5xl mb-3 block">🔥</span>
      <span className="text-orange-100 text-2xl font-medium">Outside is {absDiff}° warmer</span>
      <p className="text-orange-300/70 text-sm mt-2">Keep windows closed</p>
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
        <RefreshCw className="w-10 h-10 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-red-900/30 backdrop-blur rounded-2xl p-8 text-center border border-red-700/30 max-w-sm">
          <span className="text-4xl mb-3 block">⚠️</span>
          <span className="text-red-200 text-lg">Failed to load climate data</span>
          <p className="text-red-400/70 text-sm mt-2">Check relay URL in settings</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
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

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-900 to-slate-950">
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Climate</h1>
        <nav className="flex gap-2">
          <button
            onClick={() => setView('climate')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'climate'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
            }`}
            aria-label="Climate"
          >
            <Home className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView('settings')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'settings'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
            }`}
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
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
