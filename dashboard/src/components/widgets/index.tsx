import type { PanelConfig, WidgetType } from '../../types';
import { lazy, Suspense, type ComponentType } from 'react';

// Widget props interface
export interface WidgetComponentProps {
  panel: PanelConfig;
  dark: boolean;
  isEditMode: boolean;
}

// Lazy load widgets for code splitting
const widgetComponents: Record<WidgetType, ComponentType<WidgetComponentProps>> = {
  weather: lazy(() => import('./Weather')),
  calendar: lazy(() => import('./Calendar')),
  'drive-time': lazy(() => import('./DriveTime')),
  'sun-moon': lazy(() => import('./SunMoon')),
  aqi: lazy(() => import('./Aqi')),
  uv: lazy(() => import('./Uv')),
  kasa: lazy(() => import('./Kasa')),
  wol: lazy(() => import('./Wol')),
  brightness: lazy(() => import('./Brightness')),
  iframe: lazy(() => import('./Iframe')),
  climate: lazy(() => import('./Climate')),
  timer: lazy(() => import('./Timer')),
  ptt: lazy(() => import('./Ptt')),
};

// Loading placeholder
function WidgetLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center text-neutral-500">
      Loading...
    </div>
  );
}

// Widget renderer component
export function WidgetRenderer({ panel, dark, isEditMode }: WidgetComponentProps) {
  const Widget = widgetComponents[panel.widget];

  if (!Widget) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-500">
        Unknown widget: {panel.widget}
      </div>
    );
  }

  return (
    <Suspense fallback={<WidgetLoading />}>
      <Widget panel={panel} dark={dark} isEditMode={isEditMode} />
    </Suspense>
  );
}
