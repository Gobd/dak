import { useEffect, useState } from 'react';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  isSameMonth,
} from 'date-fns';
import {
  Check,
  X,
  Circle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
} from 'lucide-react';
import { Card, Button } from '@dak/ui';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { formatUnits, formatVolume } from '../lib/units';
import type { Entry } from '../types';

interface DayGroup {
  date: string;
  entries: Entry[];
  totalUnits: number;
}

type ViewMode = 'list' | 'calendar';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function History() {
  const { entries, fetchEntries } = useEntriesStore();
  const { target, fetchTarget } = useTargetsStore();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [viewMonth, setViewMonth] = useState(new Date());

  useEffect(() => {
    fetchTarget();
    fetchEntries(365); // Load a full year for calendar view
  }, [fetchTarget, fetchEntries]);

  const dailyLimit = target?.daily_limit ?? 14;

  // Group entries by day
  const dayGroups: DayGroup[] = entries.reduce((groups: DayGroup[], entry) => {
    const date = format(parseISO(entry.logged_at), 'yyyy-MM-dd');
    const existing = groups.find((g) => g.date === date);
    if (existing) {
      existing.entries.push(entry);
      existing.totalUnits += entry.units;
    } else {
      groups.push({ date, entries: [entry], totalUnits: entry.units });
    }
    return groups;
  }, []);

  // Create a map for quick lookup
  const dayMap = new Map(dayGroups.map((g) => [g.date, g]));

  // Sort by date descending for list view
  const sortedDayGroups = [...dayGroups].sort((a, b) => b.date.localeCompare(a.date));

  const toggleExpand = (date: string) => {
    const next = new Set(expandedDays);
    if (next.has(date)) {
      next.delete(date);
    } else {
      next.add(date);
    }
    setExpandedDays(next);
  };

  const formatDayLabel = (date: string) => {
    const parsed = parseISO(date);
    if (isToday(parsed)) return 'Today';
    if (isYesterday(parsed)) return 'Yesterday';
    return format(parsed, 'EEE, MMM d');
  };

  const getStatusIcon = (totalUnits: number) => {
    if (totalUnits === 0) {
      return <Circle size={18} className="text-success fill-success" />;
    }
    if (totalUnits <= dailyLimit) {
      return <Check size={18} className="text-success" />;
    }
    return <X size={18} className="text-danger" />;
  };

  const getStatusColor = (totalUnits: number) => {
    if (totalUnits === 0) return 'text-success';
    if (totalUnits <= dailyLimit) return 'text-success';
    return 'text-danger';
  };

  const getPercentage = (totalUnits: number) => {
    return dailyLimit > 0 ? Math.round((totalUnits / dailyLimit) * 100) : 0;
  };

  // Calendar helpers
  const getDotColor = (totalUnits: number | undefined) => {
    if (totalUnits === undefined) return 'bg-surface-sunken'; // No data
    if (totalUnits === 0) return 'bg-success'; // Zero day
    if (totalUnits <= dailyLimit) return 'bg-accent'; // Under target
    return 'bg-danger'; // Over target
  };

  const getCalendarDays = () => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const daysInMonth = monthEnd.getDate();
    const firstDayOfWeek = monthStart.getDay();

    const days: (number | null)[] = [];

    // Pad start with nulls
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    // Pad to 42 cells (6 rows)
    while (days.length < 42) {
      days.push(null);
    }

    return days;
  };

  const handlePrevMonth = () => setViewMonth(subMonths(viewMonth, 1));
  const handleNextMonth = () => setViewMonth(addMonths(viewMonth, 1));

  const isCurrentMonth = isSameMonth(viewMonth, new Date());

  const renderCalendarView = () => {
    const days = getCalendarDays();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    return (
      <Card>
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft size={20} />
          </Button>
          <h2 className="font-semibold text-lg">{format(viewMonth, 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} disabled={isCurrentMonth}>
            <ChevronRight size={20} />
          </Button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((name) => (
            <div key={name} className="text-center text-xs text-text-muted py-1 font-medium">
              {name}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const dateStr = format(
              new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day),
              'yyyy-MM-dd',
            );
            const dayData = dayMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const isFuture = new Date(dateStr) > today;

            return (
              <div
                key={day}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg relative
                  ${isToday ? 'ring-2 ring-accent' : ''}
                  ${isFuture ? 'opacity-30' : ''}
                `}
              >
                <span className="text-sm text-text-secondary">{day}</span>
                {!isFuture && (
                  <div
                    className={`w-3 h-3 rounded-full mt-0.5 ${getDotColor(dayData?.totalUnits)}`}
                    title={dayData ? `${formatUnits(dayData.totalUnits)} units` : 'No data'}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-xs text-text-muted">Zero</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-xs text-text-muted">Under</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-danger" />
            <span className="text-xs text-text-muted">Over</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-surface-sunken" />
            <span className="text-xs text-text-muted">No data</span>
          </div>
        </div>
      </Card>
    );
  };

  const renderListView = () => {
    if (sortedDayGroups.length === 0) {
      return (
        <Card className="text-center py-8">
          <p className="text-text-muted">No entries yet. Start tracking on the home page.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {sortedDayGroups.map(({ date, entries: dayEntries, totalUnits }) => {
          const isExpanded = expandedDays.has(date);
          const percentage = getPercentage(totalUnits);

          return (
            <Card key={date} padding="none" className="overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-raised transition-colors"
                onClick={() => toggleExpand(date)}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(totalUnits)}
                  <div>
                    <div className="font-medium">{formatDayLabel(date)}</div>
                    <div className="text-sm text-text-muted">
                      {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`font-semibold ${getStatusColor(totalUnits)}`}>
                      {formatUnits(totalUnits)} units
                    </div>
                    <div className="text-sm text-text-muted">{percentage}% of target</div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={20} className="text-text-muted" />
                  ) : (
                    <ChevronDown size={20} className="text-text-muted" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-4 space-y-2">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-surface-raised rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{formatUnits(entry.units)} units</div>
                        <div className="text-sm text-text-muted">
                          {formatVolume(entry.volume_ml)} @ {entry.percentage}%
                          {entry.notes && ` - ${entry.notes}`}
                        </div>
                      </div>
                      <div className="text-sm text-text-muted">
                        {format(parseISO(entry.logged_at), 'h:mm a')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            type="button"
            className={`p-2 transition-colors ${
              viewMode === 'calendar'
                ? 'bg-accent text-white'
                : 'bg-surface-raised text-text-secondary hover:bg-surface-sunken'
            }`}
            onClick={() => setViewMode('calendar')}
            title="Calendar view"
          >
            <CalendarDays size={18} />
          </button>
          <button
            type="button"
            className={`p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-accent text-white'
                : 'bg-surface-raised text-text-secondary hover:bg-surface-sunken'
            }`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? renderCalendarView() : renderListView()}
    </div>
  );
}
