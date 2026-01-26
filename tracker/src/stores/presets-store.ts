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

      // Seed defaults if user has no presets
      if (data.length === 0) {
        get().seedDefaultPresets();
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

    if (!error) {
      get().fetchPresets();
      broadcastSync({ type: 'presets' });
    }
  },

  seedDefaultPresets: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const presetsToInsert = DEFAULT_PRESETS.map((preset) => ({
      ...preset,
      user_id: userData.user.id,
    }));

    const { error } = await supabase.from('tracker_presets').insert(presetsToInsert);

    if (!error) {
      get().fetchPresets();
    }
  },
}));
