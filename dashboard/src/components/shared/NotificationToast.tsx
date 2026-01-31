import { useEffect, useState, useRef, useCallback } from 'react';
import {
  useNotificationsStore,
  type DueNotification,
  type TypePreference,
  type NotificationEvent,
} from '../../stores/notifications-store';
import { useConfigStore } from '../../stores/config-store';
import { X, Clock, AlertTriangle, Calendar, Settings, Trash2, Undo2 } from 'lucide-react';
import { Toggle, ConfirmModal } from '@dak/ui';

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
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

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
    setShowDismissConfirm(false);
  };

  return (
    <>
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
                onClick={() => setShowDismissConfirm(true)}
                className="px-3 py-1.5 text-sm bg-border hover:bg-border-strong rounded-lg transition-colors text-text flex items-center gap-1.5"
              >
                <X size={14} />
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
      <ConfirmModal
        open={showDismissConfirm}
        onClose={() => setShowDismissConfirm(false)}
        onConfirm={handleDismiss}
        title="Dismiss Notification"
        message={`Permanently dismiss "${notification.name}"? It won't appear again unless rescheduled.`}
        confirmText="Dismiss"
        variant="danger"
      />
    </>
  );
}

function TypePreferenceItem({ pref }: { pref: TypePreference }) {
  const setTypeEnabled = useNotificationsStore((s) => s.setTypeEnabled);
  const deleteType = useNotificationsStore((s) => s.deleteType);
  const isUnconfigured = pref.enabled === null;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between py-2 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium capitalize text-text truncate">{pref.type}</span>
          {isUnconfigured && (
            <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded flex-shrink-0">
              new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isUnconfigured ? (
            <>
              <button
                onClick={() => setTypeEnabled(pref.type, true)}
                className="px-2 py-1 text-xs bg-success/20 text-success hover:bg-success/30 rounded transition-colors"
              >
                Enable
              </button>
              <button
                onClick={() => setTypeEnabled(pref.type, false)}
                className="px-2 py-1 text-xs bg-border text-text-muted hover:bg-border-strong rounded transition-colors"
              >
                Disable
              </button>
            </>
          ) : (
            <Toggle
              checked={pref.enabled ?? false}
              onChange={(checked) => setTypeEnabled(pref.type, checked)}
            />
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 text-text-muted hover:text-danger transition-colors"
            title="Delete notification type"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteType(pref.type)}
        title="Delete Notification Type"
        message={`Delete "${pref.type}" and all its scheduled notifications? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}

function ScheduleItem({ event }: { event: NotificationEvent }) {
  const dueDate = new Date(event.due_date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = dueDate < today;

  return (
    <div className={`flex items-center justify-between py-2 ${isPast ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-text-muted uppercase">{event.type}</span>
        <span className="text-text truncate">{event.name}</span>
      </div>
      <span
        className={`text-sm flex-shrink-0 ${isPast ? 'text-text-muted' : 'text-text-secondary'}`}
      >
        {dueDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
  );
}

function SnoozedItem({ event }: { event: NotificationEvent }) {
  const undismiss = useNotificationsStore((s) => s.undismiss);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  const dueDate = new Date(event.due_date + 'T00:00:00');

  return (
    <>
      <div className="flex items-center justify-between py-2 opacity-60">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-text-muted uppercase">{event.type}</span>
          <span className="text-text-muted line-through truncate">{event.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-text-muted">
            {dueDate.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <button
            onClick={() => setShowUndoConfirm(true)}
            className="p-1 text-text-muted hover:text-accent transition-colors"
            title="Undo dismiss"
          >
            <Undo2 size={14} />
          </button>
        </div>
      </div>
      <ConfirmModal
        open={showUndoConfirm}
        onClose={() => setShowUndoConfirm(false)}
        onConfirm={() => undismiss(event.id)}
        title="Undo Dismiss"
        message={`Restore "${event.name}" so it shows as due again?`}
        confirmText="Restore"
      />
    </>
  );
}

export function NotificationToast() {
  const hasWidget = useHasNotificationsWidget();
  const {
    notifications,
    allEvents,
    typePreferences,
    isOpen,
    setOpen,
    fetchDue,
    fetchAllEvents,
    fetchPreferences,
    unconfiguredCount,
  } = useNotificationsStore();

  const [activeTab, setActiveTab] = useState<'due' | 'schedule' | 'snoozed' | 'settings'>(
    'settings',
  );

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset position and tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      // Go to 'due' tab if there are notifications, otherwise settings
      setActiveTab(notifications.length > 0 ? 'due' : 'settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on isOpen change
  }, [isOpen]);

  // Fetch data when switching tabs
  useEffect(() => {
    if (activeTab === 'schedule' || activeTab === 'snoozed') {
      fetchAllEvents();
    } else if (activeTab === 'settings') {
      fetchPreferences();
    }
  }, [activeTab, fetchAllEvents, fetchPreferences]);

  // Split events into upcoming and snoozed
  const upcomingEvents = allEvents
    .filter((e) => !e.dismissed_until || new Date(e.dismissed_until) <= new Date())
    .sort(
      (a, b) =>
        new Date(a.due_date + 'T00:00:00').getTime() - new Date(b.due_date + 'T00:00:00').getTime(),
    );

  const snoozedEvents = allEvents
    .filter((e) => e.dismissed_until && new Date(e.dismissed_until) > new Date())
    .sort(
      (a, b) =>
        new Date(a.due_date + 'T00:00:00').getTime() - new Date(b.due_date + 'T00:00:00').getTime(),
    )
    .slice(0, 10); // Limit to 10

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

  // Touch handlers for kiosk/tablet
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

  // Fetch all data on mount (only if widget configured)
  useEffect(() => {
    if (hasWidget) {
      fetchDue();
      fetchPreferences();
      fetchAllEvents();
    }
  }, [hasWidget, fetchDue, fetchPreferences, fetchAllEvents]);

  // Don't render anything if notifications widget is not configured
  if (!hasWidget) {
    return null;
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
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={modalRef}
        className="pointer-events-auto bg-surface-raised rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col animate-slide-up border border-border"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        {/* Header - drag handle */}
        <div
          className={`flex items-center justify-between px-3 py-2 border-b border-border ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Tab toggle */}
          <div className="flex gap-1 bg-surface-sunken rounded-lg p-0.5">
            {notifications.length > 0 && (
              <button
                onClick={() => setActiveTab('due')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === 'due'
                    ? 'bg-surface-raised text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Due ({notifications.length})
              </button>
            )}
            {upcomingEvents.length > 0 && (
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === 'schedule'
                    ? 'bg-surface-raised text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Schedule
              </button>
            )}
            {snoozedEvents.length > 0 && (
              <button
                onClick={() => setActiveTab('snoozed')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === 'snoozed'
                    ? 'bg-surface-raised text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Snoozed
              </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1 text-sm rounded-md transition-colors relative ${
                activeTab === 'settings'
                  ? 'bg-surface-raised text-text'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Settings size={14} className="inline" />
              {unconfiguredCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-text text-[10px] font-bold rounded-full flex items-center justify-center">
                  !
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="p-1 text-text-muted hover:text-text transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'due' && (
            <div className="space-y-3">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))
              ) : (
                <p className="text-text-muted text-center py-4">No due reminders</p>
              )}
            </div>
          )}
          {activeTab === 'schedule' && (
            <div className="divide-y divide-border">
              {upcomingEvents.map((event) => (
                <ScheduleItem key={event.id} event={event} />
              ))}
              {upcomingEvents.length === 0 && (
                <p className="text-text-muted text-center py-4">No scheduled notifications</p>
              )}
            </div>
          )}
          {activeTab === 'snoozed' && (
            <div className="divide-y divide-border">
              {snoozedEvents.map((event) => (
                <SnoozedItem key={event.id} event={event} />
              ))}
            </div>
          )}
          {activeTab === 'settings' && (
            <div>
              <p className="text-sm text-text-muted mb-4">
                Configure notification types. New types must be enabled or disabled before the badge
                clears.
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
          )}
        </div>
      </div>
    </div>
  );
}
