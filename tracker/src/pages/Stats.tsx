import { useEffect } from 'react';
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns';
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
  const today = format(now, 'yyyy-MM-dd');
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  // Find first entry date to avoid counting days before tracking started
  const firstEntryDate =
    entries.length > 0
      ? entries.reduce((earliest, e) => {
          const date = e.logged_at.split('T')[0];
          return date < earliest ? date : earliest;
        }, entries[0].logged_at.split('T')[0])
      : today;

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

  // Generate array of days from start to today (inclusive), respecting first entry date
  const getDaysInRange = (periodStart: Date) => {
    const effectiveStart = format(periodStart, 'yyyy-MM-dd');
    const rangeStart = effectiveStart > firstEntryDate ? effectiveStart : firstEntryDate;
    const days: string[] = [];
    let current = rangeStart;
    while (current <= today) {
      days.push(current);
      const nextDate = new Date(current + 'T12:00:00');
      nextDate.setDate(nextDate.getDate() + 1);
      current = format(nextDate, 'yyyy-MM-dd');
    }
    return days;
  };

  // This week
  const weekDays = getDaysInRange(weekStart);
  const weekEntries = entriesInRange(weekStart, now);
  const weekDailyTotals = getDailyTotalsInRange(weekEntries);
  const weekTotalUnits = weekEntries.reduce((sum, e) => sum + e.units, 0);
  const weekZeroDays = weekDays.filter((day) => (weekDailyTotals.get(day) || 0) === 0).length;
  const weekUnderDays = weekDays.filter(
    (day) => (weekDailyTotals.get(day) || 0) <= dailyLimit,
  ).length;

  // This month
  const monthDays = getDaysInRange(monthStart);
  const monthEntries = entriesInRange(monthStart, now);
  const monthDailyTotals = getDailyTotalsInRange(monthEntries);
  const monthTotalUnits = monthEntries.reduce((sum, e) => sum + e.units, 0);
  const monthZeroDays = monthDays.filter((day) => (monthDailyTotals.get(day) || 0) === 0).length;
  const monthUnderDays = monthDays.filter(
    (day) => (monthDailyTotals.get(day) || 0) <= dailyLimit,
  ).length;

  // Averages (use actual tracked days)
  const weekAverage = weekDays.length > 0 ? weekTotalUnits / weekDays.length : 0;
  const monthAverage = monthDays.length > 0 ? monthTotalUnits / monthDays.length : 0;

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
            <div className="text-2xl font-bold text-accent">
              {weekUnderDays}/{weekDays.length}
            </div>
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
              {monthDays.length > 0 ? Math.round((monthUnderDays / monthDays.length) * 100) : 0}%
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
