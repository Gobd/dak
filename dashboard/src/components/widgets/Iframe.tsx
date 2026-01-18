import type { WidgetComponentProps } from './index';

// Local dev URL mappings
const LOCAL_URL_MAP: Record<string, string> = {
  '/notes-app/': 'http://localhost:8081/',
  '/health-tracker/': 'http://localhost:5173/health-tracker/',
  '/family-chores/': 'http://localhost:5174/family-chores/',
};

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const PROD_ORIGIN = 'https://dak.bkemper.me';

function resolveUrl(url: string): string {
  if (!url) return url;

  // Check for ?local param for local dev servers
  const localMode =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('local');

  if (localMode) {
    for (const [prod, local] of Object.entries(LOCAL_URL_MAP)) {
      if (url.startsWith(prod)) {
        return url.replace(prod, local);
      }
    }
    return url;
  }

  // On localhost (not in local mode), map relative URLs to production
  if (isLocalDev && url.startsWith('/') && !url.startsWith('//')) {
    return PROD_ORIGIN + url;
  }

  return url;
}

export default function Iframe({ panel }: WidgetComponentProps) {
  const src = resolveUrl((panel.args?.src as string) || '');

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
