import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { VolumeUnit } from '../types';

interface PreferencesState {
  volumeUnit: VolumeUnit;
  loading: boolean;
  fetchPreferences: () => Promise<void>;
  setVolumeUnit: (unit: VolumeUnit) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  volumeUnit: 'ml',
  loading: false,

  fetchPreferences: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('tracker_targets')
      .select('volume_unit')
      .maybeSingle();

    if (!error && data?.volume_unit) {
      set({ volumeUnit: data.volume_unit as VolumeUnit });
    }
    set({ loading: false });
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
}));
