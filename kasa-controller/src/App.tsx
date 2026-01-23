import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Power, Sun, Moon } from 'lucide-react';
import DeviceList from './components/DeviceList';
import Settings from './components/Settings';

type View = 'devices' | 'settings';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('kasa-dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('kasa-dark-mode', String(isDark));
  }, [isDark]);

  return [isDark, setIsDark] as const;
}

export default function App() {
  const [view, setView] = useState<View>('devices');
  const [isDark, setIsDark] = useDarkMode();

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <header className="bg-surface-raised border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Kasa Controller</h1>
        <nav className="flex gap-2">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg bg-surface-sunken text-text-secondary hover:bg-border transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setView('devices')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'devices'
                ? 'bg-accent text-text'
                : 'bg-surface-sunken text-text-secondary hover:bg-border'
            }`}
            aria-label="Devices"
          >
            <Power className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView('settings')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'settings'
                ? 'bg-accent text-text'
                : 'bg-surface-sunken text-text-secondary hover:bg-border'
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
