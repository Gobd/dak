import { useEffect } from 'react';
// date-fns no longer needed - using UTC date strings directly
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

  // Calculate weekly stats using UTC dates to match server
  const now = new Date();
  const todayUtc = now.toISOString().split('T')[0];
  // Get week start (Monday) in UTC
  const nowUtc = new Date(now.toISOString());
  const dayOfWeek = nowUtc.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStartDate = new Date(nowUtc);
  weekStartDate.setUTCDate(nowUtc.getUTCDate() - daysToMonday);
  const weekStartUtc = weekStartDate.toISOString().split('T')[0];
  // Get month start in UTC
  const monthStartUtc = `${nowUtc.getUTCFullYear()}-${String(nowUtc.getUTCMonth() + 1).padStart(2, '0')}-01`;

  // Find first entry date to avoid counting days before tracking started
  const firstEntryDate =
    entries.length > 0
      ? entries.reduce((earliest, e) => {
          const date = e.logged_at.split('T')[0];
          return date < earliest ? date : earliest;
        }, entries[0].logged_at.split('T')[0])
      : todayUtc;

  // Use UTC dates to match server-side calculations
  const entriesInRange = (startDateStr: string, endDateStr: string) =>
    entries.filter((e) => {
      const dateUtc = e.logged_at.split('T')[0]; // Extract UTC date
      return dateUtc >= startDateStr && dateUtc <= endDateStr;
    });

  const getDailyTotalsInRange = (rangeEntries: Entry[]) => {
    const dailyMap = new Map<string, number>();
    rangeEntries.forEach((e) => {
      const day = e.logged_at.split('T')[0]; // UTC date from ISO string
      dailyMap.set(day, (dailyMap.get(day) || 0) + e.units);
    });
    return dailyMap;
  };

  // Generate array of UTC days from start to today (inclusive), respecting first entry date
  const getDaysInRange = (periodStartUtc: string) => {
    const rangeStart = periodStartUtc > firstEntryDate ? periodStartUtc : firstEntryDate;
    const days: string[] = [];
    let current = rangeStart;
    while (current <= todayUtc) {
      days.push(current);
      // Add one day using UTC
      const nextDate = new Date(current + 'T12:00:00Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      current = nextDate.toISOString().split('T')[0];
    }
    return days;
  };

  // This week (UTC)
  const weekDays = getDaysInRange(weekStartUtc);
  const weekEntries = entriesInRange(weekStartUtc, todayUtc);
  const weekDailyTotals = getDailyTotalsInRange(weekEntries);
  const weekTotalUnits = weekEntries.reduce((sum, e) => sum + e.units, 0);
  // Don't count today as a zero day - the day isn't complete yet
  const weekZeroDays = weekDays.filter(
    (day) => day !== todayUtc && (weekDailyTotals.get(day) || 0) === 0,
  ).length;
  const weekUnderDays = weekDays.filter(
    (day) => day !== todayUtc && (weekDailyTotals.get(day) || 0) <= dailyLimit,
  ).length;

  // This month (UTC)
  const monthDays = getDaysInRange(monthStartUtc);
  const monthEntries = entriesInRange(monthStartUtc, todayUtc);
  const monthDailyTotals = getDailyTotalsInRange(monthEntries);
  const monthTotalUnits = monthEntries.reduce((sum, e) => sum + e.units, 0);
  // Don't count today as a zero day - the day isn't complete yet
  const monthZeroDays = monthDays.filter(
    (day) => day !== todayUtc && (monthDailyTotals.get(day) || 0) === 0,
  ).length;
  const monthUnderDays = monthDays.filter(
    (day) => day !== todayUtc && (monthDailyTotals.get(day) || 0) <= dailyLimit,
  ).length;

  // Averages (use actual tracked days)
  const weekAverage = weekDays.length > 0 ? weekTotalUnits / weekDays.length : 0;
  const monthAverage = monthDays.length > 0 ? monthTotalUnits / monthDays.length : 0;

  // Today's total - used to adjust streak display
  const todayTotal = entries
    .filter((e) => e.logged_at.split('T')[0] === todayUtc)
    .reduce((sum, e) => sum + e.units, 0);
  const todayHasNoEntries = todayTotal === 0;

  // Adjust streaks to not count today (day isn't complete yet)
  // If today has no entries and DB is counting it as a zero day, subtract 1
  const displayZeroStreak = streaks
    ? todayHasNoEntries && streaks.current_zero_streak > 0
      ? streaks.current_zero_streak - 1
      : streaks.current_zero_streak
    : 0;
  const displayUnderStreak = streaks
    ? todayHasNoEntries && streaks.current_under_streak > 0
      ? streaks.current_under_streak - 1
      : streaks.current_under_streak
    : 0;

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
