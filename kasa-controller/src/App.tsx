import { useState } from 'react';
import { Settings as SettingsIcon, Power } from 'lucide-react';
import DeviceList from './components/DeviceList';
import Settings from './components/Settings';

type View = 'devices' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('devices');

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kasa Controller</h1>
        <nav className="flex gap-2">
          <button
            onClick={() => setView('devices')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'devices'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            aria-label="Devices"
          >
            <Power className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView('settings')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'settings'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </nav>
      </header>

      <main className="flex-1 p-4">{view === 'devices' ? <DeviceList /> : <Settings />}</main>
    </div>
  );
}
