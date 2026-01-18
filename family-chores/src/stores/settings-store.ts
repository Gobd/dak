import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { AppSettings } from '../types';

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  pinVerified: boolean;
  fetchSettings: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => boolean;
  clearPinVerification: () => void;
  setHidePoints: (hide: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: true,
  pinVerified: false,

  fetchSettings: async () => {
    set({ loading: true });
    const { data } = await supabase.from('app_settings').select('*').single();

    if (data) {
      set({ settings: data, loading: false });
    } else {
      // Create default settings if none exist
      const { data: newSettings } = await supabase
        .from('app_settings')
        .insert({})
        .select()
        .single();
      set({ settings: newSettings, loading: false });
    }
  },

  setPin: async (pin: string) => {
    const { data } = await supabase
      .from('app_settings')
      .update({ parent_pin: pin })
      .eq('id', get().settings?.id)
      .select()
      .single();

    if (data) {
      set({ settings: data });
    }
  },

  verifyPin: (pin: string) => {
    const isValid = get().settings?.parent_pin === pin;
    if (isValid) {
      set({ pinVerified: true });
    }
    return isValid;
  },

  clearPinVerification: () => {
    set({ pinVerified: false });
  },

  setHidePoints: async (hide: boolean) => {
    const { data } = await supabase
      .from('app_settings')
      .update({ hide_points: hide })
      .eq('id', get().settings?.id)
      .select()
      .single();

    if (data) {
      set({ settings: data });
    }
  },
}));
