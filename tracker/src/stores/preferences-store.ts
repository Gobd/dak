import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { VolumeUnit, StatsPeriodType } from '../types';

interface PreferencesState {
  volumeUnit: VolumeUnit;
  statsPeriodType: StatsPeriodType;
  loading: boolean;
  initialized: boolean;
  fetchPreferences: () => Promise<void>;
  setVolumeUnit: (unit: VolumeUnit) => Promise<void>;
  setStatsPeriodType: (type: StatsPeriodType) => void;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  volumeUnit: 'ml',
  statsPeriodType:
    (localStorage.getItem('tracker_stats_period_type') as StatsPeriodType) || 'calendar',
  loading: false,
  initialized: false,

  fetchPreferences: async () => {
    const isInitialLoad = !get().initialized;
    if (isInitialLoad) set({ loading: true });

    const { data, error } = await supabase
      .from('tracker_targets')
      .select('volume_unit')
      .maybeSingle();

    if (!error && data?.volume_unit) {
      set({ volumeUnit: data.volume_unit as VolumeUnit, loading: false, initialized: true });
    } else if (isInitialLoad) {
      set({ loading: false, initialized: true });
    }
  },

  setVolumeUnit: async (volumeUnit: VolumeUnit) => {
    // Optimistically update local state
    set({ volumeUnit });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Check if target exists
    const { data: existing } = await supabase.from('tracker_targets').select('id').maybeSingle();

    if (existing) {
      // Update existing
      await supabase
        .from('tracker_targets')
        .update({ volume_unit: volumeUnit, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      // Create new target with just the preference
      await supabase.from('tracker_targets').insert({
        user_id: userData.user.id,
        volume_unit: volumeUnit,
      });
    }

    broadcastSync({ type: 'preferences' });
  },

  setStatsPeriodType: (statsPeriodType: StatsPeriodType) => {
    localStorage.setItem('tracker_stats_period_type', statsPeriodType);
    set({ statsPeriodType });
  },
}));
