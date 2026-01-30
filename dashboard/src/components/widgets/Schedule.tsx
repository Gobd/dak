import { useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useNotificationsStore } from '../../stores/notifications-store';

export default function Schedule() {
  const { allEvents, fetchAllEvents } = useNotificationsStore();

  useEffect(() => {
    fetchAllEvents();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAllEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllEvents]);

  // Sort by due date
  const sortedEvents = [...allEvents].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="w-full h-full flex flex-col bg-surface-raised/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Calendar className="text-text-muted" size={18} />
        <span className="text-sm font-medium text-text">Upcoming</span>
        <span className="text-xs text-text-muted">({allEvents.length})</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sortedEvents.length > 0 ? (
          <div className="divide-y divide-border">
            {sortedEvents.map((event) => {
              const dueDate = new Date(event.due_date);
              const isPast = dueDate < today;
              const isToday = dueDate.toDateString() === today.toDateString();
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const isTomorrow = dueDate.toDateString() === tomorrow.toDateString();

              return (
                <div
                  key={event.id}
                  className={`flex items-center justify-between px-4 py-2 ${isPast ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-text-muted">{event.type}</span>
                      {isToday && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-warning/20 text-warning rounded">
                          today
                        </span>
                      )}
                      {isTomorrow && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                          tomorrow
                        </span>
                      )}
                      {isPast && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-danger/20 text-danger rounded">
                          overdue
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-text truncate">{event.name}</div>
                  </div>
                  <span className="text-xs text-text-secondary flex-shrink-0 ml-2">
                    {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No scheduled items
          </div>
        )}
      </div>
    </div>
  );
}
