import { useEffect, useState } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { Check, X, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@dak/ui';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { formatUnits, formatVolume } from '../lib/units';
import type { Entry } from '../types';

interface DayGroup {
  date: string;
  entries: Entry[];
  totalUnits: number;
}

export function History() {
  const { entries, fetchEntries } = useEntriesStore();
  const { target, fetchTarget } = useTargetsStore();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTarget();
    fetchEntries(90); // Load 90 days of history
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

  // Sort by date descending
  dayGroups.sort((a, b) => b.date.localeCompare(a.date));

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

  if (dayGroups.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">History</h1>
        <Card className="text-center py-8">
          <p className="text-text-muted">No entries yet. Start tracking on the home page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">History</h1>

      <div className="space-y-2">
        {dayGroups.map(({ date, entries: dayEntries, totalUnits }) => {
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
    </div>
  );
}
