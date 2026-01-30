import { useEffect, useState, useRef, useCallback } from 'react';
import {
  useNotificationsStore,
  type DueNotification,
  type TypePreference,
} from '../../stores/notifications-store';
import { useConfigStore } from '../../stores/config-store';
import { X, Clock, AlertTriangle, Calendar, Settings, Trash2 } from 'lucide-react';
import { Toggle } from '@dak/ui';

// Check if notifications widget is configured on any screen
function useHasNotificationsWidget() {
  const screens = useConfigStore((s) => s.screens);
  return screens.some((screen) => screen.panels.some((panel) => panel.widget === 'notifications'));
}

const SNOOZE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: 'Today', hours: -1 }, // Special: until midnight
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
];

function NotificationItem({ notification }: { notification: DueNotification }) {
  const dismiss = useNotificationsStore((s) => s.dismiss);
  const [showOptions, setShowOptions] = useState(false);

  const getStatusIcon = () => {
    if (notification.is_overdue) {
      return <AlertTriangle className="text-danger" size={20} />;
    }
    if (notification.is_today) {
      return <Clock className="text-warning" size={20} />;
    }
    return <Calendar className="text-accent" size={20} />;
  };

  const getStatusText = () => {
    if (notification.is_overdue) return 'Overdue';
    if (notification.is_today) return 'Due Today';
    return 'Due Tomorrow';
  };

  const handleSnooze = async (hours: number) => {
    await dismiss(notification.id, hours);
    setShowOptions(false);
  };

  const handleDismiss = async () => {
    await dismiss(notification.id, 0, true);
  };

  return (
    <div className="bg-surface-sunken rounded-lg p-4 border border-border">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getStatusIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
              {notification.type}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                notification.is_overdue
                  ? 'bg-danger/20 text-danger'
                  : notification.is_today
                    ? 'bg-warning/20 text-warning'
                    : 'bg-accent/20 text-accent'
              }`}
            >
              {getStatusText()}
            </span>
          </div>
          <div className="font-medium text-text truncate">{notification.name}</div>
          {notification.data && (
            <div className="text-sm text-text-muted mt-1">
              {Object.entries(notification.data)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Snooze/Dismiss options */}
      <div className="mt-3 flex flex-wrap gap-2">
        {showOptions ? (
          <>
            {SNOOZE_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                onClick={() => handleSnooze(opt.hours)}
                className="px-3 py-1.5 text-sm bg-border hover:bg-border-strong rounded-lg transition-colors text-text"
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setShowOptions(false)}
              className="px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowOptions(true)}
              className="px-3 py-1.5 text-sm bg-border hover:bg-border-strong rounded-lg transition-colors text-text flex items-center gap-1.5"
            >
              <Clock size={14} />
              Snooze
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-sm bg-border hover:bg-border-strong rounded-lg transition-colors text-text flex items-center gap-1.5"
            >
              <X size={14} />
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TypePreferenceItem({ pref }: { pref: TypePreference }) {
  const setTypeEnabled = useNotificationsStore((s) => s.setTypeEnabled);
  const deleteType = useNotificationsStore((s) => s.deleteType);

  return (
    <div className="flex items-center justify-between py-2 gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-medium capitalize text-text truncate">{pref.type}</span>
        {!pref.is_known && (
          <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded flex-shrink-0">
            new
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Toggle checked={pref.enabled} onChange={(checked) => setTypeEnabled(pref.type, checked)} />
        <button
          onClick={() => deleteType(pref.type)}
          className="p-1 text-text-muted hover:text-danger transition-colors"
          title="Delete notification type"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function PreferencesModal({ onClose }: { onClose: () => void }) {
  const { typePreferences, fetchPreferences } = useNotificationsStore();

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="bg-surface-raised rounded-xl shadow-2xl max-w-sm w-full max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="text-text-muted" size={20} />
            <h2 className="text-lg font-semibold text-text">Notification Types</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Type list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          <p className="text-sm text-text-muted mb-4">
            Enable notification types to receive reminders. New types are disabled by default.
          </p>
          <div className="divide-y divide-border">
            {typePreferences.map((pref) => (
              <TypePreferenceItem key={pref.type} pref={pref} />
            ))}
            {typePreferences.length === 0 && (
              <p className="text-text-muted py-4 text-center">No notification types yet</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-border hover:bg-border-strong rounded-lg transition-colors text-text"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationToast() {
  const hasWidget = useHasNotificationsWidget();
  const {
    notifications,
    isOpen,
    setOpen,
    fetchDue,
    fetchPreferences,
    unconfiguredCount,
    showPreferences,
    setShowPreferences,
  } = useNotificationsStore();

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset position when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag from header area, not buttons
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

  // Fetch due notifications and preferences on mount (only if widget configured)
  useEffect(() => {
    if (hasWidget) {
      fetchDue();
      fetchPreferences();
    }
  }, [hasWidget, fetchDue, fetchPreferences]);

  // Don't render anything if notifications widget is not configured
  if (!hasWidget) {
    return null;
  }

  // Show preferences modal
  if (showPreferences) {
    return <PreferencesModal onClose={() => setShowPreferences(false)} />;
  }

  // Modal is closed - widget handles the bell icon
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={modalRef}
        className="pointer-events-auto bg-surface-raised rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col animate-slide-up border border-border"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        {/* Header - drag handle */}
        <div
          className={`flex items-center justify-end gap-1 px-3 py-2 border-b border-border ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
        >
          <button
            onClick={() => setShowPreferences(true)}
            className="p-1 text-text-muted hover:text-text transition-colors relative"
            title="Notification settings"
          >
            <Settings size={18} />
            {unconfiguredCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-text text-[10px] font-bold rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-text-muted hover:text-text transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      </div>
    </div>
  );
}
