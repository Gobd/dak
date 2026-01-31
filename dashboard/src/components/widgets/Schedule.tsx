import { useEffect, useState } from 'react';
import { Calendar, Undo2 } from 'lucide-react';
import { ConfirmModal } from '@dak/ui';
import { useNotificationsStore, type NotificationEvent } from '../../stores/notifications-store';

function UpcomingEventRow({ event, today }: { event: NotificationEvent; today: Date }) {
  const dueDate = new Date(event.due_date + 'T00:00:00');
  const isPast = dueDate < today;
  const isToday = dueDate.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = dueDate.toDateString() === tomorrow.toDateString();

  return (
    <div className={`flex items-center justify-between px-4 py-3 ${isPast ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-text-muted">{event.type}</span>
          {isToday && (
            <span className="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded">today</span>
          )}
          {isTomorrow && (
            <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded">tomorrow</span>
          )}
          {isPast && (
            <span className="text-xs px-2 py-0.5 bg-danger/20 text-danger rounded">overdue</span>
          )}
        </div>
        <div className="text-base text-text truncate">{event.name}</div>
      </div>
      <span className="text-sm text-text-secondary flex-shrink-0 ml-3">
        {dueDate.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
  );
}

function DismissedEventRow({ event }: { event: NotificationEvent }) {
  const undismiss = useNotificationsStore((s) => s.undismiss);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  const dueDate = new Date(event.due_date + 'T00:00:00');

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 opacity-60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-text-muted">{event.type}</span>
          </div>
          <div className="text-base text-text-muted line-through truncate">{event.name}</div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-sm text-text-muted">
            {dueDate.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <button
            onClick={() => setShowUndoConfirm(true)}
            className="p-2 text-text-muted hover:text-accent transition-colors"
            title="Undo dismiss"
          >
            <Undo2 size={18} />
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

export default function Schedule() {
  const { allEvents, fetchAllEvents } = useNotificationsStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'dismissed'>('upcoming');

  useEffect(() => {
    fetchAllEvents();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAllEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllEvents]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Split into upcoming and dismissed
  const upcomingEvents = allEvents
    .filter((e) => !e.dismissed_until || new Date(e.dismissed_until) <= new Date())
    .sort(
      (a, b) =>
        new Date(a.due_date + 'T00:00:00').getTime() - new Date(b.due_date + 'T00:00:00').getTime(),
    );

  const dismissedEvents = allEvents
    .filter((e) => e.dismissed_until && new Date(e.dismissed_until) > new Date())
    .sort(
      (a, b) =>
        new Date(a.due_date + 'T00:00:00').getTime() - new Date(b.due_date + 'T00:00:00').getTime(),
    );

  const hasDismissed = dismissedEvents.length > 0;

  return (
    <div className="w-full h-full flex flex-col bg-surface-raised/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Calendar className="text-text-muted" size={20} />
          {hasDismissed ? (
            <div className="flex gap-1 bg-surface-sunken rounded-lg p-1">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  activeTab === 'upcoming'
                    ? 'bg-surface-raised text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Upcoming ({upcomingEvents.length})
              </button>
              <button
                onClick={() => setActiveTab('dismissed')}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  activeTab === 'dismissed'
                    ? 'bg-surface-raised text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Snoozed ({dismissedEvents.length})
              </button>
            </div>
          ) : (
            <>
              <span className="text-base font-medium text-text">Upcoming</span>
              <span className="text-sm text-text-muted">({upcomingEvents.length})</span>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'upcoming' ? (
          upcomingEvents.length > 0 ? (
            <div className="divide-y divide-border">
              {upcomingEvents.map((event) => (
                <UpcomingEventRow key={event.id} event={event} today={today} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              No scheduled items
            </div>
          )
        ) : (
          <div className="divide-y divide-border">
            {dismissedEvents.map((event) => (
              <DismissedEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
