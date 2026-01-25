import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../stores/settings-store';
import { Input, Button } from '@dak/ui';

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
        <Input
          label="Relay URL"
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="https://kiosk-relay.bkemper.me"
        />
        <p className="mt-2 text-sm text-text-muted">
          The URL of the home relay server with climate sensors.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Temperature Unit
        </label>
        <div className="flex gap-2">
          {(['C', 'F'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                unit === u
                  ? 'bg-accent text-text'
                  : 'bg-surface-sunken text-text-secondary hover:bg-border'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={!hasChanges} size="lg" className="flex-1 gap-2">
          <Save className="w-5 h-5" />
          {saved ? 'Saved!' : 'Save'}
        </Button>
        <Button onClick={handleReset} variant="secondary" size="lg" aria-label="Reset to default">
          <RotateCcw className="w-5 h-5" />
        </Button>
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
