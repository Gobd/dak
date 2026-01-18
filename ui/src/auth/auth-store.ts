import { create } from 'zustand';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

interface CreateAuthStoreOptions {
  supabase: SupabaseClient;
  onSignOut?: () => void;
}

export function createAuthStore({ supabase, onSignOut }: CreateAuthStoreOptions) {
  return create<AuthState>((set) => ({
    session: null,
    loading: true,

    initialize: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      set({ session, loading: false });

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session });
      });
    },

    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    },

    signUp: async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error: error as Error | null };
    },

    resetPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error as Error | null };
    },

    updatePassword: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error as Error | null };
    },

    signOut: async () => {
      onSignOut?.();
      await supabase.auth.signOut();
      set({ session: null });
    },
  }));
}

export type { AuthState };
