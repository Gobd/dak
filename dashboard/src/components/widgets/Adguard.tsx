import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Shield, ShieldOff, Settings, ChevronUp, ExternalLink } from 'lucide-react';
import { useToggle } from '@dak/hooks';
import { useConfigStore, getRelayUrl } from '../../stores/config-store';
import { Modal, Button, Spinner, Input, Alert } from '@dak/ui';
import {
  client,
  getStatusAdguardStatusPost,
  setProtectionAdguardProtectionPost,
  getVersionAdguardVersionPost,
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

interface AdguardVersion {
  current_version: string | null;
  new_version: string | null;
  update_available: boolean;
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

async function fetchVersion(config: AdguardConfig): Promise<AdguardVersion> {
  const { url, username, password } = config;
  if (!url || !username || !password) {
    throw new Error('Not configured');
  }

  client.setConfig({ baseUrl: getRelayUrl() });
  const result = await getVersionAdguardVersionPost({
    body: { url, username, password },
    throwOnError: true,
  });

  return result.data as AdguardVersion;
}

// Build URL with embedded credentials for auto-login
function buildAuthUrl(config: AdguardConfig): string {
  try {
    const url = new URL(config.url);
    url.username = config.username;
    url.password = config.password;
    return url.toString();
  } catch {
    return config.url;
  }
}

export default function Adguard({ panel }: WidgetComponentProps) {
  const queryClient = useQueryClient();
  const getWidgetData = useConfigStore((s) => s.getWidgetData);
  const updateWidgetData = useConfigStore((s) => s.updateWidgetData);

  const config = getWidgetData<AdguardConfig>(panel.id) ?? { url: '', username: '', password: '' };
  const isConfigured = !!(config.url && config.username && config.password);

  const showSettings = useToggle(false);
  const showMenu = useToggle(false);
  const [settingsForm, setSettingsForm] = useState(config);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adguard-status', panel.id],
    queryFn: () => fetchStatus(config),
    enabled: isConfigured,
    refetchInterval: 10_000,
    retry: false,
  });

  // Check for updates (every 5 minutes - just hits local AdGuard, not external API)
  const { data: versionData } = useQuery({
    queryKey: ['adguard-version', panel.id],
    queryFn: () => fetchVersion(config),
    enabled: isConfigured,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const updateAvailable = versionData?.update_available ?? false;

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
      showMenu.setFalse();
      queryClient.invalidateQueries({ queryKey: ['adguard-status', panel.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed'),
  });

  async function handleSaveSettings() {
    if (!settingsForm.url || !settingsForm.username || !settingsForm.password) {
      setSettingsError('All fields are required');
      return;
    }

    setIsTesting(true);
    setSettingsError(null);

    try {
      await fetchStatus(settingsForm);
      updateWidgetData(panel.id, settingsForm);
      showSettings.setFalse();
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['adguard-status', panel.id] });
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : 'Connection failed. Check URL and credentials.',
      );
    } finally {
      setIsTesting(false);
    }
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setSettingsForm(config);
            showSettings.setTrue();
          }}
          title="Configure AdGuard"
        >
          <Shield size={24} className="text-text-muted" />
        </Button>

        <Modal
          open={showSettings.value}
          onClose={() => {
            showSettings.setFalse();
            setSettingsError(null);
          }}
          title="AdGuard Home Settings"
          actions={
            <>
              <Button
                onClick={() => {
                  showSettings.setFalse();
                  setSettingsError(null);
                }}
                disabled={isTesting}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} variant="primary" disabled={isTesting}>
                {isTesting ? 'Testing...' : 'Save'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {settingsError && <Alert variant="error">{settingsError}</Alert>}
            <Input
              label="URL"
              placeholder="http://192.168.1.1:3000"
              value={settingsForm.url}
              onChange={(e) => setSettingsForm({ ...settingsForm, url: e.target.value })}
              disabled={isTesting}
            />
            <Input
              label="Username"
              value={settingsForm.username}
              onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
              disabled={isTesting}
            />
            <Input
              label="Password"
              type="password"
              value={settingsForm.password}
              onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
              disabled={isTesting}
            />
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {/* Main button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => showMenu.setTrue()}
        disabled={isPending}
        className="relative"
        title={
          updateAvailable
            ? 'Update available'
            : protectionEnabled
              ? 'Protection enabled'
              : 'Protection disabled'
        }
      >
        {protectionEnabled ? (
          <Shield size={24} className="text-success" />
        ) : (
          <ShieldOff size={24} className="text-danger" />
        )}
        {(isLoading || isPending) && <Spinner size="sm" className="absolute top-0.5 right-0.5" />}
        {updateAvailable && !isLoading && !isPending && (
          <ChevronUp
            size={12}
            className="absolute -top-0.5 -right-0.5 text-accent"
            strokeWidth={3}
          />
        )}
      </Button>

      {/* Countdown text */}
      {!protectionEnabled && countdown && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-text-muted whitespace-nowrap">
          {countdown}
        </span>
      )}

      {/* Control menu */}
      <Modal
        open={showMenu.value}
        onClose={() => {
          showMenu.setFalse();
          setError(null);
        }}
        title={protectionEnabled ? 'Disable Protection' : 'Protection Disabled'}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                showMenu.setFalse();
                setSettingsForm(config);
                showSettings.setTrue();
              }}
              className="opacity-70 hover:opacity-100"
              title="Settings"
            >
              <Settings size={14} className="text-text-muted" />
            </Button>
            <Button onClick={() => showMenu.setFalse()}>Cancel</Button>
          </>
        }
      >
        <div className="space-y-2">
          {error && <Alert variant="error">{error}</Alert>}

          {protectionEnabled ? (
            DURATION_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                onClick={() => handleDisable(opt.value)}
                disabled={isPending}
                className="w-full justify-start"
              >
                {opt.label}
              </Button>
            ))
          ) : (
            <div className="space-y-3">
              {countdown && <p className="text-sm text-text-muted">Re-enables in {countdown}</p>}
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

          <a
            href={buildAuthUrl(config)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-accent pt-2"
          >
            Open AdGuard Home <ExternalLink size={12} />
          </a>
        </div>
      </Modal>

      {/* Settings modal */}
      <Modal
        open={showSettings.value}
        onClose={() => {
          showSettings.setFalse();
          setSettingsError(null);
        }}
        title="AdGuard Home Settings"
        actions={
          <>
            <Button
              onClick={() => {
                showSettings.setFalse();
                setSettingsError(null);
              }}
              disabled={isTesting}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} variant="primary" disabled={isTesting}>
              {isTesting ? 'Testing...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {settingsError && <Alert variant="error">{settingsError}</Alert>}
          <Input
            label="URL"
            placeholder="http://192.168.1.1:3000"
            value={settingsForm.url}
            onChange={(e) => setSettingsForm({ ...settingsForm, url: e.target.value })}
            disabled={isTesting}
          />
          <Input
            label="Username"
            value={settingsForm.username}
            onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
            disabled={isTesting}
          />
          <Input
            label="Password"
            type="password"
            value={settingsForm.password}
            onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
            disabled={isTesting}
          />
        </div>
      </Modal>
    </div>
  );
}
