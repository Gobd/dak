import { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Modal, Button } from '@dak/ui';
import { useConfigStore } from '../../stores/config-store';
import { useSyncedClock } from '../../hooks/useRefreshInterval';
import type { WidgetComponentProps } from './index';

export default function Clock({ panel }: WidgetComponentProps) {
  const updatePanel = useConfigStore((s) => s.updatePanel);

  const use24Hour = panel.args?.use24Hour === true;
  const showDate = panel.args?.showDate !== false; // default true
  const showYear = panel.args?.showYear !== false; // default true
  const showWeekday = panel.args?.showWeekday !== false; // default true
  const showSeconds = panel.args?.showSeconds === true;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  // Clock update - sync to the second boundary for smooth updates
  useSyncedClock(() => setCurrentTime(new Date()), showSeconds);

  // Check container width to determine layout
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // If width is less than 200px, stack date under time
        setIsNarrow(entry.contentRect.width < 200);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function updateArg(key: string, value: boolean) {
    updatePanel(panel.id, {
      args: { ...panel.args, [key]: value },
    });
  }

  // Format time
  const timeStr = currentTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    ...(showSeconds && { second: '2-digit' }),
    hour12: !use24Hour,
  });

  // Format date (e.g., "Fri, Jan 1, 2026")
  const dateStr = showDate
    ? currentTime.toLocaleDateString([], {
        ...(showWeekday && { weekday: 'short' }),
        month: 'short',
        day: 'numeric',
        ...(showYear && { year: 'numeric' }),
      })
    : null;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Settings cog */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-0.5 right-0.5 p-1 rounded opacity-70 hover:opacity-100 hover:bg-surface-sunken/50 transition-all"
        title="Clock settings"
      >
        <Settings size={14} className="text-text-muted" />
      </button>

      {/* Clock display */}
      <div
        className={`w-full h-full flex items-center justify-center p-2 ${
          isNarrow && showDate ? 'flex-col gap-0' : 'gap-3'
        }`}
      >
        <span className="text-base font-medium text-text tabular-nums">{timeStr}</span>
        {dateStr && <span className="text-xs text-text-muted">{dateStr}</span>}
      </div>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Clock Settings"
        actions={
          <Button onClick={() => setShowSettings(false)} variant="primary">
            Done
          </Button>
        }
      >
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={use24Hour}
              onChange={(e) => updateArg('use24Hour', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">24-hour format</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showSeconds}
              onChange={(e) => updateArg('showSeconds', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show seconds</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showDate}
              onChange={(e) => updateArg('showDate', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show date</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showWeekday}
              onChange={(e) => updateArg('showWeekday', e.target.checked)}
              className="rounded"
              disabled={!showDate}
            />
            <span className={`text-sm ${!showDate ? 'text-text-muted' : ''}`}>
              Show day of week
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showYear}
              onChange={(e) => updateArg('showYear', e.target.checked)}
              className="rounded"
              disabled={!showDate}
            />
            <span className={`text-sm ${!showDate ? 'text-text-muted' : ''}`}>Show year</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
