import { useState, useCallback } from 'react';
import { useRefreshInterval } from '../../hooks/useRefreshInterval';
import type { WidgetComponentProps } from './index';

// Local dev URL mappings
const LOCAL_URL_MAP: Record<string, string> = {
  '/notes-app/': 'http://localhost:8081/',
  '/health-tracker/': 'http://localhost:5173/health-tracker/',
  '/family-chores/': 'http://localhost:5174/family-chores/',
};

// Apps that support dark mode via ?dark=true query param
const DARK_MODE_APPS = ['/notes-app/', '/health-tracker/', '/family-chores/'];

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const APP_URL = import.meta.env.VITE_APP_URL || 'https://dak.bkemper.me';

function resolveUrl(url: string, dark: boolean, args: Record<string, unknown> = {}): string {
  if (!url) return url;

  // Check for ?local param for local dev servers
  const localMode =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('local');

  let resolvedUrl = url;

  if (localMode) {
    for (const [prod, local] of Object.entries(LOCAL_URL_MAP)) {
      if (url.startsWith(prod)) {
        resolvedUrl = url.replace(prod, local);
        break;
      }
    }
  } else if (isLocalDev && url.startsWith('/') && !url.startsWith('//')) {
    // On localhost (not in local mode), map relative URLs to app URL
    resolvedUrl = APP_URL + url;
  }

  // Collect query params from args (excluding src)
  // Supports: string, number, boolean, and arrays (multiple values with same key)
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (key === 'src' || value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    } else {
      params.set(key, String(value));
    }
  }

  // Append dark mode param for supported apps
  if (dark && DARK_MODE_APPS.some((app) => url.startsWith(app))) {
    params.set('dark', 'true');
  }

  // Append params to URL
  const paramString = params.toString();
  if (paramString) {
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    resolvedUrl = `${resolvedUrl}${separator}${paramString}`;
  }

  return resolvedUrl;
}

export default function Iframe({ panel, dark }: WidgetComponentProps) {
  const args = (panel.args ?? {}) as Record<string, unknown>;
  const src = resolveUrl((args.src as string) || '', dark ?? false, args);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reload iframe at the configured refresh interval
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useRefreshInterval(handleRefresh, panel.refresh, { immediate: false });

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-raised text-text-muted">
        No URL specified
      </div>
    );
  }

  return (
    <iframe
      key={refreshKey}
      id={`iframe-${panel.id}`}
      src={src}
      className="w-full h-full border-0"
      title={`iframe-${panel.id}`}
      allow="fullscreen"
    />
  );
}
