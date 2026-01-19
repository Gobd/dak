import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  useConfigStore,
  testRelayConnection,
  setRelayUrl,
  getRelayUrl,
} from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { ThemeMode } from '../../types';
import { formatLocation } from '../../hooks/useLocation';

interface GlobalSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function GlobalSettingsModal({ open, onClose }: GlobalSettingsModalProps) {
  const globalSettings = useConfigStore((s) => s.globalSettings);
  const updateGlobalSettings = useConfigStore((s) => s.updateGlobalSettings);

  const [locationQuery, setLocationQuery] = useState('');
  const [relayUrlInput, setRelayUrlInput] = useState('');
  const [relayStatus, setRelayStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const currentTheme = globalSettings?.theme ?? 'dark';
  const defaultLocation = globalSettings?.defaultLocation;
  const hideCursor = globalSettings?.hideCursor ?? false;

  // Reset relay URL input when modal opens (valid pattern for form initialization)
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- form reset on modal open
      setRelayUrlInput(globalSettings?.relayUrl ?? getRelayUrl().replace(/^https?:\/\//, ''));
      setRelayStatus('idle');
    }
  }, [open, globalSettings?.relayUrl]);

  async function handleTestRelay() {
    setRelayStatus('testing');
    const success = await testRelayConnection(relayUrlInput);
    setRelayStatus(success ? 'success' : 'error');
  }

  function handleSaveRelay() {
    updateGlobalSettings({ relayUrl: relayUrlInput });
    setRelayUrl(relayUrlInput);
    setRelayStatus('idle');
  }

  function handleThemeChange(theme: ThemeMode) {
    updateGlobalSettings({ theme });
  }

  function handleLocationSelect(details: {
    address: string;
    lat?: number;
    lon?: number;
    city?: string;
    state?: string;
  }) {
    if (details.lat !== undefined && details.lon !== undefined) {
      updateGlobalSettings({
        defaultLocation: {
          lat: details.lat,
          lon: details.lon,
          city: details.city,
          state: details.state,
          query: details.address,
        },
      });
      setLocationQuery('');
    }
  }

  function handleHideCursorChange(checked: boolean) {
    updateGlobalSettings({ hideCursor: checked });
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-6">
        {/* Theme Selector */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                           border transition-colors ${
                             currentTheme === value
                               ? 'bg-blue-600 border-blue-600 text-white'
                               : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                           }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default Location */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Default Location
          </label>
          {defaultLocation && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
              Current: {formatLocation(defaultLocation.city, defaultLocation.state)}
            </p>
          )}
          <AddressAutocomplete
            value={locationQuery}
            onChange={setLocationQuery}
            onSelect={handleLocationSelect}
            placeholder="Search for a new location..."
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Used as fallback for weather, UV, and air quality widgets
          </p>
        </div>

        {/* Hide Cursor */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hideCursor}
              onChange={(e) => handleHideCursorChange(e.target.checked)}
              className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600
                         text-blue-600 focus:ring-blue-500 dark:bg-neutral-800"
            />
            <div>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Hide Cursor
              </span>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Hides the mouse cursor for kiosk displays (Ctrl+Shift+H to toggle)
              </p>
            </div>
          </label>
        </div>

        {/* Relay URL */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Relay URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={relayUrlInput}
              onChange={(e) => {
                setRelayUrlInput(e.target.value);
                setRelayStatus('idle');
              }}
              placeholder="kiosk.home.arpa:5111"
              className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600
                         bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              onClick={handleTestRelay}
              variant="default"
              disabled={relayStatus === 'testing'}
            >
              {relayStatus === 'testing' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : relayStatus === 'success' ? (
                <CheckCircle size={18} className="text-green-500" />
              ) : relayStatus === 'error' ? (
                <XCircle size={18} className="text-red-500" />
              ) : (
                'Test'
              )}
            </Button>
            <Button
              onClick={handleSaveRelay}
              variant="primary"
              disabled={relayUrlInput === (globalSettings?.relayUrl ?? '')}
            >
              Save
            </Button>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Home-relay server for Kasa, WoL, brightness, and config sync
          </p>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={onClose} variant="primary">
          Done
        </Button>
      </div>
    </Modal>
  );
}
