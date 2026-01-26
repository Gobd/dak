import { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Modal, Button, Toggle } from '@dak/ui';
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
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setShowSettings(true)}
        className="absolute top-0.5 right-0.5 opacity-70 hover:opacity-100"
        title="Clock settings"
      >
        <Settings size={14} className="text-text-muted" />
      </Button>

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
          <Toggle
            checked={use24Hour}
            onChange={(checked) => updateArg('use24Hour', checked)}
            label="24-hour format"
          />
          <Toggle
            checked={showSeconds}
            onChange={(checked) => updateArg('showSeconds', checked)}
            label="Show seconds"
          />
          <Toggle
            checked={showDate}
            onChange={(checked) => updateArg('showDate', checked)}
            label="Show date"
          />
          <Toggle
            checked={showWeekday}
            onChange={(checked) => updateArg('showWeekday', checked)}
            label="Show day of week"
            disabled={!showDate}
          />
          <Toggle
            checked={showYear}
            onChange={(checked) => updateArg('showYear', checked)}
            label="Show year"
            disabled={!showDate}
          />
        </div>
      </Modal>
    </div>
  );
}
