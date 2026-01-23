import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';

const DEFAULT_RELAY_URL = 'https://kiosk-relay.bkemper.me';

export default function Settings() {
  const { relayUrl, setRelayUrl, unit, setUnit } = useSettingsStore();
  const [inputValue, setInputValue] = useState(relayUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const url = inputValue.trim().replace(/\/$/, '');
    setRelayUrl(url);
    setInputValue(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setInputValue(DEFAULT_RELAY_URL);
    setRelayUrl(DEFAULT_RELAY_URL);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasChanges = inputValue.trim().replace(/\/$/, '') !== relayUrl;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="relay-url" className="block text-sm font-medium text-slate-300 mb-2">
          Relay URL
        </label>
        <input
          id="relay-url"
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="https://kiosk-relay.bkemper.me"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-2 text-sm text-slate-500">
          The URL of the home relay server with climate sensors.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Temperature Unit</label>
        <div className="flex gap-2">
          {(['C', 'F'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                unit === u
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors"
          aria-label="Reset to default"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="pt-4 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Current Configuration</h3>
        <div className="p-3 bg-slate-800 rounded-lg">
          <code className="text-sm text-slate-400 break-all">{relayUrl}</code>
        </div>
      </div>
    </div>
  );
}
