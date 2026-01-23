import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Shield, ShieldOff, Settings, RefreshCw, AlertCircle } from 'lucide-react';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { Modal, Button } from '@dak/ui';
import {
  client,
  getStatusAdguardStatusPost,
  setProtectionAdguardProtectionPost,
} from '@dak/api-client';
import type { WidgetComponentProps } from './index';

interface AdguardConfig {
  url: string;
  username: string;
  password: string;
}

interface AdguardStatus {
  protection_enabled: boolean;
  protection_disabled_until: string | null;
  running: boolean;
}

const DURATION_OPTIONS = [
  { label: '10 min', value: 10 * 60 * 1000 },
  { label: '30 min', value: 30 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '2 hours', value: 2 * 60 * 60 * 1000 },
];

async function fetchStatus(config: AdguardConfig): Promise<AdguardStatus> {
  const { url, username, password } = config;
  if (!url || !username || !password) {
    throw new Error('Not configured');
  }

  client.setConfig({ baseUrl: getRelayUrl() });
  const result = await getStatusAdguardStatusPost({
    body: { url, username, password },
    throwOnError: true,
  });

  return result.data as AdguardStatus;
}

async function setProtection(
  config: AdguardConfig,
  enabled: boolean,
  duration?: number,
): Promise<void> {
  const { url, username, password } = config;

  client.setConfig({ baseUrl: getRelayUrl() });
  await setProtectionAdguardProtectionPost({
    body: { url, username, password, enabled, duration: duration ?? null },
    throwOnError: true,
  });
}

export default function Adguard({ panel, dark }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const getWidgetData = useConfigStore((s) => s.getWidgetData);
  const updateWidgetData = useConfigStore((s) => s.updateWidgetData);

  const config = getWidgetData<AdguardConfig>(panel.id) ?? { url: '', username: '', password: '' };
  const isConfigured = !!(config.url && config.username && config.password);

  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [settingsForm, setSettingsForm] = useState(config);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adguard-status', panel.id],
    queryFn: () => fetchStatus(config),
    enabled: isConfigured,
    refetchInterval: 10_000,
    retry: false,
  });

  // Calculate countdown when protection is disabled
  const updateCountdown = useCallback(() => {
    if (!data?.protection_disabled_until) {
      setCountdown(null);
      return;
    }

    const until = new Date(data.protection_disabled_until).getTime();
    const now = Date.now();
    const diff = until - now;

    if (diff <= 0) {
      setCountdown(null);
      refetch();
      return;
    }

    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);

    if (hours > 0) {
      setCountdown(`${hours}h ${minutes}m`);
    } else if (minutes > 0) {
      setCountdown(`${minutes}m ${seconds}s`);
    } else {
      setCountdown(`${seconds}s`);
    }
  }, [data?.protection_disabled_until, refetch]);

  useEffect(() => {
    updateCountdown();
    if (data?.protection_disabled_until) {
      countdownRef.current = setInterval(updateCountdown, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [data?.protection_disabled_until, updateCountdown]);

  const protectionMutation = useMutation({
    mutationFn: ({ enabled, duration }: { enabled: boolean; duration?: number }) =>
      setProtection(config, enabled, duration),
    onSuccess: () => {
      setError(null);
      setShowMenu(false);
      queryClient.invalidateQueries({ queryKey: ['adguard-status', panel.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed'),
  });

  function handleSaveSettings() {
    updateWidgetData(panel.id, settingsForm);
    setShowSettings(false);
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['adguard-status', panel.id] });
  }

  function handleDisable(durationMs: number) {
    protectionMutation.mutate({ enabled: false, duration: durationMs });
  }

  function handleEnable() {
    protectionMutation.mutate({ enabled: true });
  }

  const protectionEnabled = data?.protection_enabled ?? true;
  const isPending = protectionMutation.isPending;

  // Not configured - show settings button
  if (!isConfigured) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <button
          onClick={() => {
            setSettingsForm(config);
            setShowSettings(true);
          }}
          className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-neutral-700/30' : 'hover:bg-neutral-200/50'}`}
          title="Configure AdGuard"
        >
          <Shield size={24} className="text-neutral-500" />
        </button>

        <Modal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          title="AdGuard Home Settings"
          actions={
            <>
              <Button onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button onClick={handleSaveSettings} variant="primary">
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">URL</label>
              <input
                type="text"
                placeholder="http://192.168.1.1:3000"
                value={settingsForm.url}
                onChange={(e) => setSettingsForm({ ...settingsForm, url: e.target.value })}
                className={`w-full px-3 py-2 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Username</label>
              <input
                type="text"
                value={settingsForm.username}
                onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
                className={`w-full px-3 py-2 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                value={settingsForm.password}
                onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
                className={`w-full px-3 py-2 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {/* Main button */}
      <button
        onClick={() => setShowMenu(true)}
        disabled={isPending}
        className="relative p-2"
        title={protectionEnabled ? 'Protection enabled' : 'Protection disabled'}
      >
        {protectionEnabled ? (
          <Shield size={24} className="text-green-500" />
        ) : (
          <ShieldOff size={24} className="text-red-500" />
        )}
        {(isLoading || isPending) && (
          <RefreshCw size={10} className="absolute top-0.5 right-0.5 text-blue-400 animate-spin" />
        )}
      </button>

      {/* Countdown text */}
      {!protectionEnabled && countdown && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-neutral-500 whitespace-nowrap">
          {countdown}
        </span>
      )}

      {/* Settings gear */}
      <button
        onClick={() => {
          setSettingsForm(config);
          setShowSettings(true);
        }}
        className={`absolute top-0 right-0 p-1 rounded opacity-0 hover:opacity-100 transition-opacity ${
          dark ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-200/50'
        }`}
        title="Settings"
      >
        <Settings size={12} className="text-neutral-500" />
      </button>

      {/* Control menu */}
      <Modal
        open={showMenu}
        onClose={() => {
          setShowMenu(false);
          setError(null);
        }}
        title={protectionEnabled ? 'Disable Protection' : 'Protection Disabled'}
        actions={
          <>
            <button
              onClick={() => {
                setShowMenu(false);
                setSettingsForm(config);
                setShowSettings(true);
              }}
              className="p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
              title="Settings"
            >
              <Settings size={16} className="text-neutral-500" />
            </button>
            <Button onClick={() => setShowMenu(false)}>Cancel</Button>
          </>
        }
      >
        <div className="space-y-2">
          {error && (
            <div className="p-2 bg-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {protectionEnabled ? (
            DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleDisable(opt.value)}
                disabled={isPending}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  dark ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-200/50'
                }`}
              >
                {opt.label}
              </button>
            ))
          ) : (
            <div className="space-y-3">
              {countdown && <p className="text-sm text-neutral-500">Re-enables in {countdown}</p>}
              <Button
                onClick={handleEnable}
                disabled={isPending}
                variant="primary"
                className="w-full"
              >
                Turn On Now
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Settings modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="AdGuard Home Settings"
        actions={
          <>
            <Button onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} variant="primary">
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">URL</label>
            <input
              type="text"
              placeholder="http://192.168.1.1:3000"
              value={settingsForm.url}
              onChange={(e) => setSettingsForm({ ...settingsForm, url: e.target.value })}
              className={`w-full px-3 py-2 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              type="text"
              value={settingsForm.username}
              onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
              className={`w-full px-3 py-2 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={settingsForm.password}
              onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
              className={`w-full px-3 py-2 rounded border ${dark ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-neutral-300'}`}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
