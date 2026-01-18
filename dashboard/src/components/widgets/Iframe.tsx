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

const PROD_ORIGIN = 'https://dak.bkemper.me';

function resolveUrl(url: string, dark: boolean): string {
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
    // On localhost (not in local mode), map relative URLs to production
    resolvedUrl = PROD_ORIGIN + url;
  }

  // Append dark mode param for supported apps
  if (dark && DARK_MODE_APPS.some((app) => url.startsWith(app))) {
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    resolvedUrl = `${resolvedUrl}${separator}dark=true`;
  }

  return resolvedUrl;
}

export default function Iframe({ panel, dark }: WidgetComponentProps) {
  const src = resolveUrl((panel.args?.src as string) || '', dark);

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
        No URL specified
      </div>
    );
  }

  return (
    <iframe
      src={src}
      className="w-full h-full border-0"
      title={`iframe-${panel.id}`}
      allow="fullscreen"
    />
  );
}
