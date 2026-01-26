import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { Target } from '../types';

interface TargetsState {
  target: Target | null;
  loading: boolean;
  fetchTarget: () => Promise<void>;
  setTarget: (dailyLimit: number) => Promise<void>;
}

export const useTargetsStore = create<TargetsState>((set, get) => ({
  target: null,
  loading: false,

  fetchTarget: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('tracker_targets').select('*').single();

    if (!error && data) {
      set({ target: data });
    }
    set({ loading: false });
  },

  setTarget: async (dailyLimit: number) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const existing = get().target;

    if (existing) {
      // Update existing target
      const { error } = await supabase
        .from('tracker_targets')
        .update({ daily_limit: dailyLimit, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (!error) {
        get().fetchTarget();
        broadcastSync({ type: 'targets' });
      }
    } else {
      // Create new target
      const { error } = await supabase.from('targets').insert({
        user_id: userData.user.id,
        daily_limit: dailyLimit,
      });

      if (!error) {
        get().fetchTarget();
        broadcastSync({ type: 'targets' });
      }
    }
  },
}));
