import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../lib/error';
import type { Plan, PlanLimits } from '../constants/plan-limits';
import { getPlanLimits } from '../constants/plan-limits';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_period: 'monthly' | 'annual' | null;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserStore {
  profile: UserProfile | null;
  planLimits: PlanLimits;
  isLoading: boolean;
  error: string | null;

  fetchProfile: (userId: string) => Promise<void>;
  updateDisplayName: (userId: string, displayName: string) => Promise<void>;
  updatePlan: (userId: string, plan: Plan) => Promise<void>; // For testing
  clearProfile: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  profile: null,
  planLimits: getPlanLimits('free'),
  isLoading: false,
  error: null,

  fetchProfile: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

      if (error) throw error;

      const profile = data as UserProfile;
      set({
        profile,
        planLimits: getPlanLimits(profile.plan),
        isLoading: false,
      });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
    }
  },

  updateDisplayName: async (userId: string, displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ display_name: displayName.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      const profile = data as UserProfile;
      set({ profile, isLoading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  // For testing - allows changing plan without Stripe
  updatePlan: async (userId: string, plan: Plan) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ plan, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      const profile = data as UserProfile;
      set({
        profile,
        planLimits: getPlanLimits(profile.plan),
        isLoading: false,
      });
    } catch (err) {
      set({ error: getErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  clearProfile: () => {
    set({
      profile: null,
      planLimits: getPlanLimits('free'),
    });
  },
}));
