import { useEffect } from 'react';
import { format, parseISO, startOfWeek, startOfMonth, addDays, subDays } from 'date-fns';
import { Flame, Target, TrendingDown, Calendar, Award, Lightbulb } from 'lucide-react';
import { Card } from '@dak/ui';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { usePreferencesStore } from '../stores/preferences-store';
import { formatUnits } from '../lib/units';
import { getInsight } from '../lib/motivation';
import type { Entry } from '../types';

export function Stats() {
  const { entries, streaks, fetchEntries, fetchStreaks } = useEntriesStore();
  const { target, fetchTarget } = useTargetsStore();
  const { statsPeriodType, setStatsPeriodType } = usePreferencesStore();

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

  // Use local dates for user-facing stats (matches History.tsx)
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  // Calendar periods
  const calWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const calWeekStartStr = format(calWeekStart, 'yyyy-MM-dd');
  const calMonthStart = startOfMonth(now);
  const calMonthStartStr = format(calMonthStart, 'yyyy-MM-dd');

  // Rolling periods (last 7 and 30 days)
  const rolling7Start = subDays(now, 6); // 6 days ago + today = 7 days
  const rolling7StartStr = format(rolling7Start, 'yyyy-MM-dd');
  const rolling30Start = subDays(now, 29); // 29 days ago + today = 30 days
  const rolling30StartStr = format(rolling30Start, 'yyyy-MM-dd');

  // Use selected period type
  const isRolling = statsPeriodType === 'rolling';
  const weekStartStr = isRolling ? rolling7StartStr : calWeekStartStr;
  const monthStartStr = isRolling ? rolling30StartStr : calMonthStartStr;

  // Find first entry date to avoid counting days before tracking started
  // Convert entry timestamps to local date for consistency
  const firstEntryDate =
    entries.length > 0
      ? entries.reduce(
          (earliest, e) => {
            const date = format(parseISO(e.logged_at), 'yyyy-MM-dd');
            return date < earliest ? date : earliest;
          },
          format(parseISO(entries[0].logged_at), 'yyyy-MM-dd'),
        )
      : todayStr;

  // Filter entries by local date range
  const entriesInRange = (startDateStr: string, endDateStr: string) =>
    entries.filter((e) => {
      const dateLocal = format(parseISO(e.logged_at), 'yyyy-MM-dd');
      return dateLocal >= startDateStr && dateLocal <= endDateStr;
    });

  const getDailyTotalsInRange = (rangeEntries: Entry[]) => {
    const dailyMap = new Map<string, number>();
    rangeEntries.forEach((e) => {
      const day = format(parseISO(e.logged_at), 'yyyy-MM-dd');
      dailyMap.set(day, (dailyMap.get(day) || 0) + e.units);
    });
    return dailyMap;
  };

  // Generate array of local days from start to today (inclusive), respecting first entry date
  const getDaysInRange = (periodStartStr: string) => {
    const rangeStart = periodStartStr > firstEntryDate ? periodStartStr : firstEntryDate;
    const days: string[] = [];
    let currentDate = new Date(rangeStart + 'T12:00:00'); // noon to avoid DST issues
    const endDate = new Date(todayStr + 'T12:00:00');
    while (currentDate <= endDate) {
      days.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }
    return days;
  };

  // This week (UTC)
  const weekDays = getDaysInRange(weekStartStr);
  const weekEntries = entriesInRange(weekStartStr, todayStr);
  const weekDailyTotals = getDailyTotalsInRange(weekEntries);
  const weekTotalUnits = weekEntries.reduce((sum, e) => sum + e.units, 0);
  // Don't count today as a zero day - the day isn't complete yet
  const weekZeroDays = weekDays.filter(
    (day) => day !== todayStr && (weekDailyTotals.get(day) || 0) === 0,
  ).length;
  const weekUnderDays = weekDays.filter(
    (day) => day !== todayStr && (weekDailyTotals.get(day) || 0) <= dailyLimit,
  ).length;

  // This month (UTC)
  const monthDays = getDaysInRange(monthStartStr);
  const monthEntries = entriesInRange(monthStartStr, todayStr);
  const monthDailyTotals = getDailyTotalsInRange(monthEntries);
  const monthTotalUnits = monthEntries.reduce((sum, e) => sum + e.units, 0);
  // Don't count today as a zero day - the day isn't complete yet
  const monthZeroDays = monthDays.filter(
    (day) => day !== todayStr && (monthDailyTotals.get(day) || 0) === 0,
  ).length;
  const monthUnderDays = monthDays.filter(
    (day) => day !== todayStr && (monthDailyTotals.get(day) || 0) <= dailyLimit,
  ).length;

  // Averages (use actual tracked days)
  const weekAverage = weekDays.length > 0 ? weekTotalUnits / weekDays.length : 0;
  const monthAverage = monthDays.length > 0 ? monthTotalUnits / monthDays.length : 0;

  // Streaks from DB exclude today (incomplete day), so use directly
  const displayZeroStreak = streaks?.current_zero_streak ?? 0;
  const displayUnderStreak = streaks?.current_under_streak ?? 0;

  // Insight based on patterns
  const insight = getInsight(streaks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stats</h1>
        <div className="flex rounded-lg overflow-hidden border border-border text-sm">
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors ${
              statsPeriodType === 'calendar'
                ? 'bg-accent text-white'
                : 'bg-surface-raised text-text-secondary hover:bg-surface-sunken'
            }`}
            onClick={() => setStatsPeriodType('calendar')}
          >
            Calendar
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors ${
              statsPeriodType === 'rolling'
                ? 'bg-accent text-white'
                : 'bg-surface-raised text-text-secondary hover:bg-surface-sunken'
            }`}
            onClick={() => setStatsPeriodType('rolling')}
          >
            Rolling
          </button>
        </div>
      </div>

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
          <div className="text-3xl font-bold text-success">{displayZeroStreak}</div>
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
          <div className="text-3xl font-bold text-accent">{displayUnderStreak}</div>
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

      {/* Week / 7 Days */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-accent" />
          <h2 className="font-semibold">{isRolling ? 'Last 7 Days' : 'This Week'}</h2>
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

      {/* Month / 30 Days */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Award size={20} className="text-accent" />
          <h2 className="font-semibold">{isRolling ? 'Last 30 Days' : 'This Month'}</h2>
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
