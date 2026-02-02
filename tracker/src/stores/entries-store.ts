import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import { calculateUnits } from '../lib/units';
import type { Entry, DailyTotal, StreakStats } from '../types';
import { format, startOfDay, subDays } from 'date-fns';

interface EntriesState {
  entries: Entry[];
  todayEntries: Entry[];
  dailyTotals: DailyTotal[];
  streaks: StreakStats | null;
  loading: boolean;
  initialized: boolean;
  fetchTodayEntries: () => Promise<void>;
  fetchEntries: (days?: number) => Promise<void>;
  fetchDailyTotals: (days?: number) => Promise<void>;
  fetchStreaks: (dailyLimit: number) => Promise<void>;
  addEntry: (
    volumeMl: number,
    percentage: number,
    dailyLimit: number,
    notes?: string,
    loggedAt?: Date,
  ) => Promise<void>;
  updateEntry: (
    id: string,
    volumeMl: number,
    percentage: number,
    notes?: string,
  ) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<void>;
  getTodayTotal: () => number;
}

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  todayEntries: [],
  dailyTotals: [],
  streaks: null,
  loading: false,
  initialized: false,

  fetchTodayEntries: async () => {
    // Use local day boundaries converted to ISO (includes timezone offset)
    const todayStart = startOfDay(new Date()).toISOString();
    const tomorrowStart = startOfDay(subDays(new Date(), -1)).toISOString();
    const { data, error } = await supabase
      .from('tracker_entries')
      .select('*')
      .gte('logged_at', todayStart)
      .lt('logged_at', tomorrowStart)
      .order('logged_at', { ascending: false });

    if (!error && data) {
      set({ todayEntries: data });
    }
  },

  fetchEntries: async (days = 30) => {
    const isInitialLoad = !get().initialized;
    if (isInitialLoad) set({ loading: true });

    const startOfRange = subDays(startOfDay(new Date()), days);
    const { data, error } = await supabase
      .from('tracker_entries')
      .select('*')
      .gte('logged_at', startOfRange.toISOString())
      .order('logged_at', { ascending: false });

    if (!error && data) {
      set({ entries: data, loading: false, initialized: true });
    } else if (isInitialLoad) {
      set({ loading: false, initialized: true });
    }
  },

  fetchDailyTotals: async (days = 30) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const startDate = format(subDays(startOfDay(new Date()), days), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await supabase.rpc('tracker_get_daily_totals', {
      p_user_id: userData.user.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (!error && data) {
      set({ dailyTotals: data });
    }
  },

  fetchStreaks: async (dailyLimit: number) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase.rpc('tracker_get_streak_stats', {
      p_user_id: userData.user.id,
      p_daily_limit: dailyLimit,
    });

    if (!error && data && data.length > 0) {
      set({ streaks: data[0] });
    }
  },

  addEntry: async (
    volumeMl: number,
    percentage: number,
    dailyLimit: number,
    notes?: string,
    loggedAt?: Date,
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      console.error('addEntry: no authenticated user');
      return;
    }

    const units = calculateUnits(volumeMl, percentage);

    const { error } = await supabase.from('tracker_entries').insert({
      user_id: userData.user.id,
      volume_ml: volumeMl,
      percentage,
      units,
      daily_limit: dailyLimit,
      notes: notes || null,
      logged_at: (loggedAt ?? new Date()).toISOString(),
    });

    if (error) {
      console.error('addEntry error:', error);
      return;
    }
    get().fetchTodayEntries();
    get().fetchEntries();
    broadcastSync({ type: 'entries' });
  },

  updateEntry: async (id: string, volumeMl: number, percentage: number, notes?: string) => {
    // Only allow editing today's entries
    const entry = get().todayEntries.find((e) => e.id === id);
    if (!entry) {
      return false;
    }

    const units = calculateUnits(volumeMl, percentage);

    const { error } = await supabase
      .from('tracker_entries')
      .update({
        volume_ml: volumeMl,
        percentage,
        units,
        notes: notes || null,
      })
      .eq('id', id);

    if (!error) {
      get().fetchTodayEntries();
      get().fetchEntries();
      broadcastSync({ type: 'entries' });
      return true;
    }
    return false;
  },

  deleteEntry: async (id: string) => {
    const { error } = await supabase.from('tracker_entries').delete().eq('id', id);

    if (!error) {
      get().fetchTodayEntries();
      get().fetchEntries();
      broadcastSync({ type: 'entries' });
    }
  },

  getTodayTotal: () => {
    return get().todayEntries.reduce((sum, entry) => sum + entry.units, 0);
  },
}));
