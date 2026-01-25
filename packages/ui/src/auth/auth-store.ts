import { create } from 'zustand';
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading (for compatibility)
  isInitialized: boolean;
  pendingEmail: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  register: (email: string) => Promise<{ error: Error | null }>; // Email-first registration
  setPassword: (password: string) => Promise<{ error: Error | null }>; // Set password after email verification
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

interface CreateAuthStoreOptions {
  supabase: SupabaseClient;
  onSignOut?: () => void;
  /** Base path for redirects (e.g., '/notes-app'). Defaults to '' */
  basePath?: string;
}

function getRedirectUrl(basePath: string, path: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${basePath}${path}`;
  }
  return `${basePath}${path}`;
}

export function createAuthStore({ supabase, onSignOut, basePath = '' }: CreateAuthStoreOptions) {
  return create<AuthState>((set) => ({
    session: null,
    user: null,
    loading: true,
    isLoading: false,
    isInitialized: false,
    pendingEmail: null,

    initialize: async () => {
      try {
        // Set up auth state listener FIRST (before getSession)
        // This ensures we catch recovery/signup tokens from URL
        supabase.auth.onAuthStateChange((event, session) => {
          set({
            session,
            user: session?.user ?? null,
          });

          // Mark as initialized on auth events
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            set({ isInitialized: true });
          }
        });

        // Now get the current session (also processes URL tokens)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        set({
          session,
          user: session?.user ?? null,
          loading: false,
          isInitialized: true,
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        set({ loading: false, isInitialized: true });
      }
    },

    signIn: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) {
          set({ user: data.user, session: data.session });
        }
        return { error: error as Error | null };
      } finally {
        set({ isLoading: false });
      }
    },

    signUp: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getRedirectUrl(basePath, '/'),
          },
        });
        return { error: error as Error | null };
      } finally {
        set({ isLoading: false });
      }
    },

    // Email-first registration: create user with temp password, send verification email
    register: async (email: string) => {
      set({ isLoading: true });
      try {
        const tempPassword = crypto.randomUUID();
        const { error } = await supabase.auth.signUp({
          email,
          password: tempPassword,
          options: {
            emailRedirectTo: getRedirectUrl(basePath, '/set-password'),
          },
        });
        if (!error) {
          set({ pendingEmail: email });
        }
        return { error: error as Error | null };
      } finally {
        set({ isLoading: false });
      }
    },

    // Set password after email verification (used with register flow)
    setPassword: async (password: string) => {
      set({ isLoading: true });
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) {
          set({ pendingEmail: null });
        }
        return { error: error as Error | null };
      } finally {
        set({ isLoading: false });
      }
    },

    resetPassword: async (email: string) => {
      set({ isLoading: true });
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getRedirectUrl(basePath, '/reset-password'),
        });
        return { error: error as Error | null };
      } finally {
        set({ isLoading: false });
      }
    },

    updatePassword: async (password: string) => {
      set({ isLoading: true });
      try {
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error as Error | null };
      } finally {
        set({ isLoading: false });
      }
    },

    signOut: async () => {
      set({ isLoading: true });
      try {
        onSignOut?.();
        await supabase.auth.signOut();
        set({ session: null, user: null });
      } finally {
        set({ isLoading: false });
      }
    },
  }));
}

export type { AuthState };
