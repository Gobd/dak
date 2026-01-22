import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  CheckCircle,
  XCircle,
  Loader2,
  Mic,
  Volume2,
  Plus,
  Minus,
  Download,
} from 'lucide-react';
import {
  useConfigStore,
  testRelayConnection,
  setRelayUrl,
  getRelayUrl,
} from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import { AddressAutocomplete } from './AddressAutocomplete';
import type {
  ThemeMode,
  WakeWord,
  VoskModel,
  VoskModelInfo,
  TtsVoice,
  TtsVoiceInfo,
  VoiceResponseMode,
} from '../../types';
import { formatLocation } from '../../hooks/useLocation';

const WAKE_WORD_OPTIONS: { value: WakeWord; label: string }[] = [
  { value: 'hey_jarvis', label: 'Hey Jarvis' },
  { value: 'alexa', label: 'Alexa' },
  { value: 'hey_mycroft', label: 'Hey Mycroft' },
  { value: 'hey_rhasspy', label: 'Hey Rhasspy' },
];

const RESPONSE_MODE_OPTIONS: { value: VoiceResponseMode; label: string; description: string }[] = [
  { value: 'both', label: 'Both', description: 'Speak and show popup' },
  { value: 'tts', label: 'TTS Only', description: 'Speak response (requires Piper)' },
  { value: 'modal', label: 'Popup Only', description: 'Show text popup' },
  { value: 'none', label: 'None', description: 'No response feedback' },
];

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
  const [zigbeeUrlInput, setZigbeeUrlInput] = useState('');
  const [relayStatus, setRelayStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [zigbeeStatus, setZigbeeStatus] = useState<'idle' | 'testing' | 'success' | 'error'>(
    'idle'
  );
  const [volume, setVolume] = useState(50);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [voiceModels, setVoiceModels] = useState<VoskModelInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [ttsVoices, setTtsVoices] = useState<TtsVoiceInfo[]>([]);
  const [ttsDownloadProgress, setTtsDownloadProgress] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTheme = globalSettings?.theme ?? 'dark';
  const defaultLocation = globalSettings?.defaultLocation;
  const hideCursor = globalSettings?.hideCursor ?? false;
  const voiceEnabled = globalSettings?.voiceEnabled ?? false;
  const wakeWord = globalSettings?.wakeWord ?? 'hey_jarvis';
  const voiceModel = globalSettings?.voiceModel ?? 'small';
  const ttsVoice = globalSettings?.ttsVoice ?? 'amy';
  const voiceResponseMode = globalSettings?.voiceResponseMode ?? 'both';
  const maxRecordingDuration = globalSettings?.maxRecordingDuration ?? 10;

  // Reset relay URL input when modal opens
  useEffect(() => {
    if (open) {
      setRelayUrlInput(globalSettings?.relayUrl ?? getRelayUrl().replace(/^https?:\/\//, ''));
      setZigbeeUrlInput(globalSettings?.zigbeeUrl ?? 'https://zigbee2mqtt.bkemper.me');
      setRelayStatus('idle');
      setZigbeeStatus('idle');
    }
  }, [open, globalSettings?.relayUrl, globalSettings?.zigbeeUrl]);

  // Fetch current volume when modal opens
  useEffect(() => {
    if (open) {
      const relayUrl = getRelayUrl();
      if (relayUrl) {
        fetch(`${relayUrl}/volume`)
          .then((res) => res.json())
          .then((data) => {
            if (typeof data.volume === 'number') {
              setVolume(data.volume);
            }
          })
          .catch(() => {
            // Ignore errors - volume endpoint may not exist
          });
      }
    }
  }, [open]);

  // Fetch voice models and TTS voices when modal opens and voice is enabled
  useEffect(() => {
    if (open && voiceEnabled) {
      const relayUrl = getRelayUrl();
      if (relayUrl) {
        fetch(`${relayUrl}/voice/models`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setVoiceModels(data);
            }
          })
          .catch(() => {
            // Ignore errors
          });
        fetch(`${relayUrl}/voice/tts/voices`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setTtsVoices(data);
            }
          })
          .catch(() => {
            // Ignore errors
          });
      }
    }
  }, [open, voiceEnabled]);

  // Download a voice model
  const downloadModel = useCallback(async (modelId: VoskModel) => {
    const relayUrl = getRelayUrl();
    if (!relayUrl) return;

    setDownloadProgress(0);

    try {
      const response = await fetch(`${relayUrl}/voice/models/${modelId}/download`, {
        method: 'POST',
      });

      if (!response.ok) {
        setDownloadProgress(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setDownloadProgress(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.progress !== undefined) {
                setDownloadProgress(data.progress);
              }
              if (data.status === 'complete') {
                setDownloadProgress(null);
                // Refresh models list
                const res = await fetch(`${relayUrl}/voice/models`);
                const models = await res.json();
                if (Array.isArray(models)) {
                  setVoiceModels(models);
                }
              }
              if (data.status === 'error') {
                setDownloadProgress(null);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch {
      setDownloadProgress(null);
    }
  }, []);

  // Download a TTS voice
  const downloadTtsVoice = useCallback(async (voiceId: TtsVoice) => {
    const relayUrl = getRelayUrl();
    if (!relayUrl) return;

    setTtsDownloadProgress(0);

    try {
      const response = await fetch(`${relayUrl}/voice/tts/voices/${voiceId}/download`, {
        method: 'POST',
      });

      if (!response.ok) {
        setTtsDownloadProgress(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setTtsDownloadProgress(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.progress !== undefined) {
                setTtsDownloadProgress(data.progress);
              }
              if (data.status === 'complete') {
                setTtsDownloadProgress(null);
                // Refresh voices list
                const res = await fetch(`${relayUrl}/voice/tts/voices`);
                const voices = await res.json();
                if (Array.isArray(voices)) {
                  setTtsVoices(voices);
                }
              }
              if (data.status === 'error') {
                setTtsDownloadProgress(null);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch {
      setTtsDownloadProgress(null);
    }
  }, []);

  // Play test sound at current volume
  const playTestSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(
        'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgAVKrgx3JNAhRKruTDaDwCHUux4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQ=='
      );
    }
    audioRef.current.volume = volume / 100;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [volume]);

  // Change volume via relay
  const changeVolume = useCallback(
    async (newVolume: number) => {
      const clamped = Math.max(0, Math.min(100, newVolume));
      setVolume(clamped);

      const relayUrl = getRelayUrl();
      if (relayUrl) {
        setVolumeLoading(true);
        try {
          await fetch(`${relayUrl}/volume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volume: clamped }),
          });
          // Play test sound after setting
          setTimeout(playTestSound, 100);
        } catch {
          // Ignore errors
        } finally {
          setVolumeLoading(false);
        }
      }
    },
    [playTestSound]
  );

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

  async function handleTestZigbee() {
    setZigbeeStatus('testing');
    try {
      const url = zigbeeUrlInput.startsWith('http') ? zigbeeUrlInput : `https://${zigbeeUrlInput}`;
      await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      // no-cors means we can't read the response, but if it doesn't throw, the server is reachable
      setZigbeeStatus('success');
    } catch {
      setZigbeeStatus('error');
    }
  }

  function handleSaveZigbee() {
    updateGlobalSettings({ zigbeeUrl: zigbeeUrlInput });
    setZigbeeStatus('idle');
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

        {/* Volume Control */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            <Volume2 size={18} />
            Volume
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeVolume(volume - 10)}
              disabled={volumeLoading || volume <= 0}
              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={volume}
                onChange={(e) => changeVolume(parseInt(e.target.value, 10))}
                disabled={volumeLoading}
                className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-neutral-500">
                {volume}%
              </div>
            </div>
            <button
              onClick={() => changeVolume(volume + 10)}
              disabled={volumeLoading || volume >= 100}
              className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Plays a test sound when changed. Controls kiosk speaker volume.
          </p>
        </div>

        {/* Voice Control */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => updateGlobalSettings({ voiceEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600
                         text-blue-600 focus:ring-blue-500 dark:bg-neutral-800"
            />
            <div className="flex items-center gap-2">
              <Mic size={18} className="text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Voice Control
              </span>
            </div>
          </label>
          {voiceEnabled && (
            <div className="ml-8">
              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Wake Word
              </label>
              <select
                value={wakeWord}
                onChange={(e) => updateGlobalSettings({ wakeWord: e.target.value as WakeWord })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {WAKE_WORD_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Say the wake word, then your command (e.g., "add milk to groceries")
              </p>

              {/* Speech Model Selector */}
              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1 mt-4">
                Speech Model
              </label>
              <div className="flex gap-2">
                <select
                  value={voiceModel}
                  onChange={(e) =>
                    updateGlobalSettings({ voiceModel: e.target.value as VoskModel })
                  }
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600
                             bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {voiceModels.length > 0 ? (
                    voiceModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.size}) {m.downloaded ? '✓' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="small">Standard (40MB)</option>
                      <option value="medium">Better (128MB)</option>
                      <option value="large">Best (1.8GB)</option>
                    </>
                  )}
                </select>
                {(() => {
                  const selectedModel = voiceModels.find((m) => m.id === voiceModel);
                  const isDownloaded = selectedModel?.downloaded ?? false;
                  const isDownloading = downloadProgress !== null;

                  if (isDownloaded) {
                    return (
                      <div className="flex items-center px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <CheckCircle size={16} />
                      </div>
                    );
                  }

                  if (isDownloading) {
                    return (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 min-w-[80px]">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs">{downloadProgress}%</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={() => downloadModel(voiceModel)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm"
                    >
                      <Download size={16} />
                      Download
                    </button>
                  );
                })()}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Larger models are more accurate but slower. Download required before use.
              </p>

              {/* TTS Voice Selector */}
              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1 mt-4">
                TTS Voice (for spoken responses)
              </label>
              <div className="flex gap-2">
                <select
                  value={ttsVoice}
                  onChange={(e) => updateGlobalSettings({ ttsVoice: e.target.value as TtsVoice })}
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600
                             bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {ttsVoices.length > 0 ? (
                    ttsVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} - {v.description} ({v.size}) {v.downloaded ? '✓' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="amy">Amy - Female, clear</option>
                      <option value="danny">Danny - Male, casual</option>
                      <option value="lessac">Lessac - Male, professional</option>
                      <option value="ryan">Ryan - Male, warm</option>
                    </>
                  )}
                </select>
                {(() => {
                  const selectedVoice = ttsVoices.find((v) => v.id === ttsVoice);
                  const isDownloaded = selectedVoice?.downloaded ?? false;
                  const isDownloading = ttsDownloadProgress !== null;

                  if (isDownloaded) {
                    return (
                      <div className="flex items-center px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <CheckCircle size={16} />
                      </div>
                    );
                  }

                  if (isDownloading) {
                    return (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 min-w-[80px]">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs">{ttsDownloadProgress}%</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={() => downloadTtsVoice(ttsVoice)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm"
                    >
                      <Download size={16} />
                      Download
                    </button>
                  );
                })()}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Voice used for spoken responses (e.g., climate check). Requires Piper on kiosk.
              </p>

              {/* Response Mode Selector */}
              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1 mt-4">
                Response Mode
              </label>
              <select
                value={voiceResponseMode}
                onChange={(e) =>
                  updateGlobalSettings({ voiceResponseMode: e.target.value as VoiceResponseMode })
                }
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {RESPONSE_MODE_OPTIONS.map(({ value, label, description }) => (
                  <option key={value} value={value}>
                    {label} — {description}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                How to show responses from commands like weather and climate check
              </p>

              {/* Max Recording Duration */}
              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1 mt-4">
                Max Recording Duration
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={maxRecordingDuration}
                  onChange={(e) =>
                    updateGlobalSettings({ maxRecordingDuration: parseInt(e.target.value, 10) })
                  }
                  className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-300 w-12 text-right">
                  {maxRecordingDuration}s
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Max time for PTT and wake word recording (5-30 seconds)
              </p>

              <details className="mt-3">
                <summary className="text-xs text-blue-500 cursor-pointer hover:text-blue-400">
                  View available commands
                </summary>
                <ul className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 space-y-1 pl-2">
                  <li>"add [item] to [list]" — add to groceries, shopping, etc.</li>
                  <li>"what's the weather" — indoor temp + today's high/low</li>
                  <li>"is it warmer/colder outside" — compare indoor/outdoor temp</li>
                  <li>"turn on/off [device]" — control Kasa devices</li>
                  <li>"set [X] minute timer [called Y]" — start a timer</li>
                  <li>"add [X] minutes [to Y timer]" — add time</li>
                  <li>"subtract [X] minutes [from Y timer]" — remove time</li>
                  <li>"stop/cancel [name] timer" — dismiss alarm or cancel</li>
                  <li>"help" — list commands</li>
                </ul>
              </details>
            </div>
          )}
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
              placeholder="kiosk-relay.bkemper.me"
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

        {/* Zigbee2MQTT URL */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Zigbee2MQTT URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={zigbeeUrlInput}
              onChange={(e) => {
                setZigbeeUrlInput(e.target.value);
                setZigbeeStatus('idle');
              }}
              placeholder="https://zigbee2mqtt.bkemper.me"
              className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600
                         bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              onClick={handleTestZigbee}
              variant="default"
              disabled={zigbeeStatus === 'testing'}
            >
              {zigbeeStatus === 'testing' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : zigbeeStatus === 'success' ? (
                <CheckCircle size={18} className="text-green-500" />
              ) : zigbeeStatus === 'error' ? (
                <XCircle size={18} className="text-red-500" />
              ) : (
                'Test'
              )}
            </Button>
            <Button
              onClick={handleSaveZigbee}
              variant="primary"
              disabled={
                zigbeeUrlInput === (globalSettings?.zigbeeUrl ?? 'https://zigbee2mqtt.bkemper.me')
              }
            >
              Save
            </Button>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Zigbee2MQTT web interface for climate sensors
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
