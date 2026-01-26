import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { Target } from '../types';

interface CalcParams {
  count: number;
  volumeMl: number;
  percentage: number;
}

interface TargetsState {
  target: Target | null;
  loading: boolean;
  fetchTarget: () => Promise<void>;
  setTarget: (dailyLimit: number, calcParams?: CalcParams) => Promise<void>;
}

export const useTargetsStore = create<TargetsState>((set, get) => ({
  target: null,
  loading: false,

  fetchTarget: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('tracker_targets').select('*').maybeSingle();

    if (!error && data) {
      set({ target: data });
    }
    set({ loading: false });
  },

  setTarget: async (dailyLimit: number, calcParams?: CalcParams) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const existing = get().target;

    const calcFields = calcParams
      ? {
          calc_count: calcParams.count,
          calc_volume_ml: calcParams.volumeMl,
          calc_percentage: calcParams.percentage,
        }
      : {};

    if (existing) {
      // Update existing target
      const { error } = await supabase
        .from('tracker_targets')
        .update({
          daily_limit: dailyLimit,
          ...calcFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (!error) {
        get().fetchTarget();
        broadcastSync({ type: 'targets' });
      }
    } else {
      // Create new target
      const { error } = await supabase.from('tracker_targets').insert({
        user_id: userData.user.id,
        daily_limit: dailyLimit,
        ...calcFields,
      });

      if (!error) {
        get().fetchTarget();
        broadcastSync({ type: 'targets' });
      }
    }
  },
}));
