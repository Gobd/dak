import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@dak/ui';
import type { WidgetComponentProps } from './index';

// Local dev URL mappings (same as Iframe widget)
const LOCAL_URL_MAP: Record<string, string> = {
  '/notes-app/': 'http://localhost:8081/',
  '/health-tracker/': 'http://localhost:5173/health-tracker/',
  '/family-chores/': 'http://localhost:5174/family-chores/',
  '/maintenance-tracker/': 'http://localhost:5175/maintenance-tracker/',
};

const DARK_MODE_APPS = [
  '/notes-app/',
  '/health-tracker/',
  '/family-chores/',
  '/maintenance-tracker/',
];

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const APP_URL = import.meta.env.VITE_APP_URL || 'https://dak.bkemper.me';

function resolveUrl(url: string, dark: boolean, args: Record<string, unknown> = {}): string {
  if (!url) return url;

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
    resolvedUrl = APP_URL + url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (['src', 'icon', 'popupWidth', 'popupHeight', 'title'].includes(key)) continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    } else {
      params.set(key, String(value));
    }
  }

  if (dark && DARK_MODE_APPS.some((app) => url.startsWith(app))) {
    params.set('dark', 'true');
  }

  const paramString = params.toString();
  if (paramString) {
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    resolvedUrl = `${resolvedUrl}${separator}${paramString}`;
  }

  return resolvedUrl;
}

// Dynamic icon component
function DynamicIcon({
  name,
  size = 24,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  // Convert kebab-case or lowercase to PascalCase
  const iconName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[iconName];

  if (!IconComponent) {
    // Fallback to ExternalLink if icon not found
    return <LucideIcons.ExternalLink size={size} className={className} />;
  }

  return <IconComponent size={size} className={className} />;
}

export default function IframePopup({ panel, dark }: WidgetComponentProps) {
  const args = (panel.args ?? {}) as Record<string, unknown>;
  const src = resolveUrl((args.src as string) || '', dark ?? false, args);
  const icon = (args.icon as string) || 'external-link';
  const title = (args.title as string) || 'App';
  const popupWidth = (args.popupWidth as number) || 70; // % of viewport
  const popupHeight = (args.popupHeight as number) || 80; // % of viewport

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // Reset position when popup opens
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    },
    [position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for tablet/kiosk
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const touch = e.touches[0];
      setIsDragging(true);
      dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    },
    [position],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.current.x,
        y: touch.clientY - dragStart.current.y,
      });
    },
    [isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-raised text-text-muted rounded-full">
        <LucideIcons.AlertCircle size={24} />
      </div>
    );
  }

  return (
    <>
      {/* Icon button - matches other frameless widgets */}
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} title={title}>
        <DynamicIcon name={icon} size={24} className="text-text-muted" />
      </Button>

      {/* Popup overlay - portaled to body so z-index works correctly */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Backdrop - clickable to close */}
            <div
              className="absolute inset-0 bg-black/40 pointer-events-auto"
              onClick={() => setIsOpen(false)}
            />

            {/* Popup window */}
            <div
              ref={popupRef}
              className="pointer-events-auto bg-surface-raised rounded-xl shadow-2xl flex flex-col overflow-hidden border border-border animate-slide-up"
              style={{
                width: `${popupWidth}vw`,
                height: `${popupHeight}vh`,
                transform: `translate(${position.x}px, ${position.y}px)`,
              }}
            >
              {/* Header - drag handle */}
              <div
                className={`flex items-center justify-between px-4 py-2 border-b border-border bg-surface-sunken ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                <div className="flex items-center gap-2">
                  <DynamicIcon name={icon} size={16} />
                  <span className="text-sm font-medium text-text">{title}</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-text-muted hover:text-text transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Iframe content */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  src={src}
                  className="w-full h-full border-0"
                  title={title}
                  allow="fullscreen"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
