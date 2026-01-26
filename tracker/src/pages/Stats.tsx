import { useEffect } from 'react';
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { Flame, Target, TrendingDown, Calendar, Award, Lightbulb } from 'lucide-react';
import { Card } from '@dak/ui';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { formatUnits } from '../lib/units';
import { getInsight } from '../lib/motivation';
import type { Entry } from '../types';

export function Stats() {
  const { entries, streaks, fetchEntries, fetchStreaks } = useEntriesStore();
  const { target, fetchTarget } = useTargetsStore();

  useEffect(() => {
    fetchTarget();
    fetchEntries(365); // Load a full year
  }, [fetchTarget, fetchEntries]);

  useEffect(() => {
    if (target) {
      fetchStreaks(target.daily_limit);
    }
  }, [target, fetchStreaks]);

  const dailyLimit = target?.daily_limit ?? 14;

  // Calculate weekly stats
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const entriesInRange = (start: Date, end: Date) =>
    entries.filter((e) => {
      const date = parseISO(e.logged_at);
      return date >= start && date <= end;
    });

  const getDailyTotalsInRange = (rangeEntries: Entry[]) => {
    const dailyMap = new Map<string, number>();
    rangeEntries.forEach((e) => {
      const day = format(parseISO(e.logged_at), 'yyyy-MM-dd');
      dailyMap.set(day, (dailyMap.get(day) || 0) + e.units);
    });
    return dailyMap;
  };

  // This week
  const weekEntries = entriesInRange(weekStart, weekEnd);
  const weekDailyTotals = getDailyTotalsInRange(weekEntries);
  const weekTotalUnits = weekEntries.reduce((sum, e) => sum + e.units, 0);
  const weekZeroDays = Array.from({ length: 7 }, (_, i) => {
    const day = format(subDays(weekEnd, 6 - i), 'yyyy-MM-dd');
    return (weekDailyTotals.get(day) || 0) === 0;
  }).filter(Boolean).length;
  const weekUnderDays = Array.from({ length: 7 }, (_, i) => {
    const day = format(subDays(weekEnd, 6 - i), 'yyyy-MM-dd');
    return (weekDailyTotals.get(day) || 0) <= dailyLimit;
  }).filter(Boolean).length;

  // This month
  const monthEntries = entriesInRange(monthStart, monthEnd);
  const monthDailyTotals = getDailyTotalsInRange(monthEntries);
  const monthTotalUnits = monthEntries.reduce((sum, e) => sum + e.units, 0);
  const daysInMonth = now.getDate();
  const monthZeroDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = format(subDays(now, daysInMonth - 1 - i), 'yyyy-MM-dd');
    return (monthDailyTotals.get(day) || 0) === 0;
  }).filter(Boolean).length;
  const monthUnderDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = format(subDays(now, daysInMonth - 1 - i), 'yyyy-MM-dd');
    return (monthDailyTotals.get(day) || 0) <= dailyLimit;
  }).filter(Boolean).length;

  // Averages
  const weekAverage = weekTotalUnits / 7;
  const monthAverage = monthTotalUnits / daysInMonth;

  // Insight based on patterns
  const insight = getInsight(streaks);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stats</h1>

      {/* Insight Banner */}
      {insight && (
        <Card className="bg-accent/5 border-accent/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-accent/10 shrink-0">
              <Lightbulb size={18} className="text-accent" />
            </div>
            <p className="text-text-secondary text-sm">{insight}</p>
          </div>
        </Card>
      )}

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-4">
        {/* Zero Day Streak */}
        <Card className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-success/10">
              <Flame size={24} className="text-success" />
            </div>
          </div>
          <div className="text-3xl font-bold text-success">{streaks?.current_zero_streak ?? 0}</div>
          <div className="text-sm text-text-muted">Zero Day Streak</div>
          <div className="text-xs text-text-muted mt-1">
            Best: {streaks?.longest_zero_streak ?? 0}
          </div>
        </Card>

        {/* Under Target Streak */}
        <Card className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-accent/10">
              <Target size={24} className="text-accent" />
            </div>
          </div>
          <div className="text-3xl font-bold text-accent">{streaks?.current_under_streak ?? 0}</div>
          <div className="text-sm text-text-muted">Under Target Streak</div>
          <div className="text-xs text-text-muted mt-1">
            Best: {streaks?.longest_under_streak ?? 0}
          </div>
        </Card>
      </div>

      {/* Over Target (guilt) */}
      {streaks && streaks.current_over_streak > 0 && (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-danger/10">
              <TrendingDown size={20} className="text-danger" />
            </div>
            <div>
              <div className="font-semibold text-danger">
                {streaks.current_over_streak} days over target
              </div>
              <div className="text-sm text-text-muted">Time to get back on track</div>
            </div>
          </div>
        </Card>
      )}

      {/* This Week */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-accent" />
          <h2 className="font-semibold">This Week</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{formatUnits(weekTotalUnits)}</div>
            <div className="text-sm text-text-muted">Total units</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">{weekZeroDays}</div>
            <div className="text-sm text-text-muted">Zero days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent">{weekUnderDays}/7</div>
            <div className="text-sm text-text-muted">Under target</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border text-center">
          <span className="text-text-muted">Daily average: </span>
          <span className="font-semibold">{formatUnits(weekAverage)} units</span>
        </div>
      </Card>

      {/* This Month */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Award size={20} className="text-accent" />
          <h2 className="font-semibold">This Month</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{formatUnits(monthTotalUnits)}</div>
            <div className="text-sm text-text-muted">Total units</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">{monthZeroDays}</div>
            <div className="text-sm text-text-muted">Zero days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent">
              {Math.round((monthUnderDays / daysInMonth) * 100)}%
            </div>
            <div className="text-sm text-text-muted">Under target</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border text-center">
          <span className="text-text-muted">Daily average: </span>
          <span className="font-semibold">{formatUnits(monthAverage)} units</span>
        </div>
      </Card>

      {/* All-Time Stats */}
      {streaks && streaks.days_tracked > 7 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-text-muted" />
            <h2 className="font-semibold">All Time ({streaks.days_tracked} days)</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-success">{streaks.total_zero_days}</div>
              <div className="text-sm text-text-muted">Zero days</div>
              <div className="text-xs text-text-muted">
                {Math.round((streaks.total_zero_days / streaks.days_tracked) * 100)}% of all days
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{streaks.total_under_days}</div>
              <div className="text-sm text-text-muted">Under target days</div>
              <div className="text-xs text-text-muted">
                {Math.round((streaks.total_under_days / streaks.days_tracked) * 100)}% of all days
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
