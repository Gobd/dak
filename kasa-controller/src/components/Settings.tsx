import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';

const DEFAULT_RELAY_URL = 'http://localhost:5111';

export default function Settings() {
  const { relayUrl, setRelayUrl } = useSettingsStore();
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
        <label htmlFor="relay-url" className="block text-sm font-medium text-text-secondary mb-2">
          Relay URL
        </label>
        <input
          id="relay-url"
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="http://localhost:5111"
          className="w-full px-4 py-3 bg-surface-sunken border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
        <p className="mt-2 text-sm text-text-muted">
          The URL of the home relay server that controls your Kasa devices.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-text rounded-xl font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 bg-surface-sunken text-text rounded-xl hover:bg-border transition-colors"
          aria-label="Reset to default"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-text-secondary mb-2">Current Configuration</h3>
        <div className="p-3 bg-surface-sunken rounded-lg">
          <code className="text-sm text-text-muted break-all">{relayUrl}</code>
        </div>
      </div>
    </div>
  );
}
