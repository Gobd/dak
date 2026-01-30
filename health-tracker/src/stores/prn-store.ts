import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { PrnMed, PrnLog } from '../types';

interface PrnState {
  meds: PrnMed[];
  logs: Record<string, PrnLog[]>;
  loading: boolean;
  initialized: boolean;
  fetchMeds: () => Promise<void>;
  fetchLogs: (medId: string) => Promise<void>;
  addMed: (data: { person_id: string; name: string; min_hours: number }) => Promise<void>;
  updateMed: (id: string, data: { name?: string; min_hours?: number }) => Promise<void>;
  deleteMed: (id: string) => Promise<void>;
  giveMed: (medId: string, givenAt?: Date) => Promise<boolean>;
  undoLastDose: (medId: string) => Promise<boolean>;
}

export const usePrnStore = create<PrnState>((set, get) => ({
  meds: [],
  logs: {},
  loading: false,
  initialized: false,

  fetchMeds: async () => {
    const isInitialLoad = !get().initialized;
    if (isInitialLoad) set({ loading: true });

    const { data, error } = await supabase
      .from('prn_meds')
      .select('*, person:people(*)')
      .order('name');

    if (!error && data) {
      set({ meds: data, loading: false, initialized: true });
      data.forEach((med) => {
        get().fetchLogs(med.id);
      });
    } else if (isInitialLoad) {
      set({ loading: false, initialized: true });
    }
  },

  fetchLogs: async (medId: string) => {
    const { data, error } = await supabase
      .from('prn_logs')
      .select('*')
      .eq('med_id', medId)
      .order('given_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      set((state) => ({
        logs: { ...state.logs, [medId]: data },
      }));
    }
  },

  addMed: async (data) => {
    const { error } = await supabase.from('prn_meds').insert(data);

    if (!error) {
      get().fetchMeds();
      broadcastSync({ type: 'prn' });
    }
  },

  updateMed: async (id: string, data) => {
    const { error } = await supabase.from('prn_meds').update(data).eq('id', id);

    if (!error) {
      get().fetchMeds();
      broadcastSync({ type: 'prn' });
    }
  },

  deleteMed: async (id: string) => {
    const { error } = await supabase.from('prn_meds').delete().eq('id', id);

    if (!error) {
      get().fetchMeds();
      broadcastSync({ type: 'prn' });
    }
  },

  giveMed: async (medId: string, givenAt?: Date) => {
    const { error } = await supabase.from('prn_logs').insert({
      med_id: medId,
      given_at: (givenAt || new Date()).toISOString(),
    });

    if (!error) {
      get().fetchLogs(medId);
      broadcastSync({ type: 'prn' });
      return true;
    }
    return false;
  },

  undoLastDose: async (medId: string) => {
    const medLogs = get().logs[medId] || [];
    if (medLogs.length === 0) return false;

    const lastLog = medLogs[0];
    const { error } = await supabase.from('prn_logs').delete().eq('id', lastLog.id);

    if (!error) {
      get().fetchLogs(medId);
      broadcastSync({ type: 'prn' });
      return true;
    }
    return false;
  },
}));
