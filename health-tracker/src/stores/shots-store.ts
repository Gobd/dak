import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { ShotSchedule, ShotLog } from '../types';
import { addDays, format } from 'date-fns';

interface ShotsState {
  schedules: ShotSchedule[];
  logs: Record<string, ShotLog[]>;
  loading: boolean;
  fetchSchedules: () => Promise<void>;
  fetchLogs: (scheduleId: string) => Promise<void>;
  addSchedule: (data: {
    person_id: string;
    name: string;
    interval_days: number;
    current_dose: string;
    next_due: string;
  }) => Promise<void>;
  updateSchedule: (id: string, data: Partial<ShotSchedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  logShot: (scheduleId: string, dose: string, notes?: string, takenAt?: Date) => Promise<boolean>;
  pushNextDue: (scheduleId: string, days: number) => Promise<void>;
  deleteLog: (scheduleId: string, logId: string) => Promise<void>;
}

export const useShotsStore = create<ShotsState>((set, get) => ({
  schedules: [],
  logs: {},
  loading: false,

  fetchSchedules: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('shot_schedules')
      .select('*, person:people(*)')
      .order('name');

    if (!error && data) {
      set({ schedules: data });
    }
    set({ loading: false });
  },

  fetchLogs: async (scheduleId: string) => {
    const { data, error } = await supabase
      .from('shot_logs')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('taken_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      set((state) => ({
        logs: { ...state.logs, [scheduleId]: data },
      }));
    }
  },

  addSchedule: async (data) => {
    const { error } = await supabase.from('shot_schedules').insert(data);

    if (!error) {
      get().fetchSchedules();
      broadcastSync({ type: 'shots' });
    }
  },

  updateSchedule: async (id: string, data: Partial<ShotSchedule>) => {
    const { error } = await supabase.from('shot_schedules').update(data).eq('id', id);

    if (!error) {
      get().fetchSchedules();
      broadcastSync({ type: 'shots' });
    }
  },

  deleteSchedule: async (id: string) => {
    const { error } = await supabase.from('shot_schedules').delete().eq('id', id);

    if (!error) {
      get().fetchSchedules();
      broadcastSync({ type: 'shots' });
    }
  },

  logShot: async (scheduleId: string, dose: string, notes?: string, takenAt?: Date) => {
    const schedule = get().schedules.find((s) => s.id === scheduleId);
    if (!schedule) return false;

    const shotTime = takenAt || new Date();

    // Log the shot
    const { error } = await supabase.from('shot_logs').insert({
      schedule_id: scheduleId,
      taken_at: shotTime.toISOString(),
      dose,
      notes: notes || null,
    });

    if (error) return false;

    // Update next due date
    const nextDue = addDays(shotTime, schedule.interval_days);
    await supabase
      .from('shot_schedules')
      .update({
        next_due: format(nextDue, 'yyyy-MM-dd'),
        current_dose: dose,
      })
      .eq('id', scheduleId);

    get().fetchSchedules();
    get().fetchLogs(scheduleId);
    broadcastSync({ type: 'shots' });
    return true;
  },

  pushNextDue: async (scheduleId: string, days: number) => {
    const schedule = get().schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    // Parse as local date (append time to avoid UTC interpretation)
    const currentDue = new Date(schedule.next_due + 'T00:00:00');
    const newDue = addDays(currentDue, days);

    await supabase
      .from('shot_schedules')
      .update({ next_due: format(newDue, 'yyyy-MM-dd') })
      .eq('id', scheduleId);

    get().fetchSchedules();
    broadcastSync({ type: 'shots' });
  },

  deleteLog: async (scheduleId: string, logId: string) => {
    const schedule = get().schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    const { error } = await supabase.from('shot_logs').delete().eq('id', logId);

    if (error) return;

    // Fetch remaining logs to recalculate next_due
    const { data: remainingLogs } = await supabase
      .from('shot_logs')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('taken_at', { ascending: false })
      .limit(1);

    if (remainingLogs && remainingLogs.length > 0) {
      // Recalculate from most recent remaining log
      const lastLog = remainingLogs[0];
      const nextDue = addDays(new Date(lastLog.taken_at), schedule.interval_days);
      await supabase
        .from('shot_schedules')
        .update({
          next_due: format(nextDue, 'yyyy-MM-dd'),
          current_dose: lastLog.dose,
        })
        .eq('id', scheduleId);
    }

    get().fetchSchedules();
    get().fetchLogs(scheduleId);
    broadcastSync({ type: 'shots' });
  },
}));
