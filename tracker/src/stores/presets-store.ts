import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { Preset } from '../types';
import { DEFAULT_PRESETS } from '../types';

interface PresetsState {
  presets: Preset[];
  loading: boolean;
  fetchPresets: () => Promise<void>;
  addPreset: (name: string, volumeMl: number, percentage: number) => Promise<void>;
  updatePreset: (id: string, name: string, volumeMl: number, percentage: number) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  seedDefaultPresets: () => Promise<void>;
}

let isSeeding = false; // Guard against concurrent seeding

export const usePresetsStore = create<PresetsState>((set, get) => ({
  presets: [],
  loading: false,

  fetchPresets: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('tracker_presets')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      set({ presets: data });

      // Seed defaults only once per user (check DB flag + guard)
      if (data.length === 0 && !isSeeding) {
        const { data: target } = await supabase
          .from('tracker_targets')
          .select('presets_seeded')
          .maybeSingle();

        if (!target?.presets_seeded) {
          await get().seedDefaultPresets();
        }
      }
    }
    set({ loading: false });
  },

  addPreset: async (name: string, volumeMl: number, percentage: number) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const maxSortOrder = Math.max(...get().presets.map((p) => p.sort_order), -1);

    const { error } = await supabase.from('tracker_presets').insert({
      user_id: userData.user.id,
      name,
      volume_ml: volumeMl,
      percentage,
      sort_order: maxSortOrder + 1,
    });

    if (!error) {
      get().fetchPresets();
      broadcastSync({ type: 'presets' });
    }
  },

  updatePreset: async (id: string, name: string, volumeMl: number, percentage: number) => {
    const { error } = await supabase
      .from('tracker_presets')
      .update({ name, volume_ml: volumeMl, percentage })
      .eq('id', id);

    if (!error) {
      get().fetchPresets();
      broadcastSync({ type: 'presets' });
    }
  },

  deletePreset: async (id: string) => {
    const { error } = await supabase.from('tracker_presets').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete preset:', error);
      return;
    }

    get().fetchPresets();
    broadcastSync({ type: 'presets' });
  },

  seedDefaultPresets: async () => {
    if (isSeeding) return;
    isSeeding = true;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const presetsToInsert = DEFAULT_PRESETS.map((preset) => ({
        ...preset,
        user_id: userData.user.id,
      }));

      const { error } = await supabase.from('tracker_presets').insert(presetsToInsert);

      if (!error) {
        // Mark as seeded - update existing or create minimal target row
        const { data: existingTarget } = await supabase
          .from('tracker_targets')
          .select('id')
          .maybeSingle();

        if (existingTarget) {
          await supabase
            .from('tracker_targets')
            .update({ presets_seeded: true })
            .eq('id', existingTarget.id);
        } else {
          await supabase.from('tracker_targets').insert({
            user_id: userData.user.id,
            presets_seeded: true,
          });
        }

        // Refetch presets directly (no recursive fetchPresets call)
        const { data: newPresets } = await supabase
          .from('tracker_presets')
          .select('*')
          .order('sort_order', { ascending: true });

        if (newPresets) {
          set({ presets: newPresets });
        }
      }
    } finally {
      isSeeding = false;
    }
  },
}));
