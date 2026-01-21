import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Production web URL - used for all email redirects
const PRODUCTION_URL = 'https://notes-app-e20.pages.dev';

function getRedirectUrl(path: string): string {
  // On web, use current origin (supports localhost dev)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/notes-app${path}`;
  }
  // Fallback to production URL
  return `${PRODUCTION_URL}${path}`;
}

interface AuthStore {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  pendingEmail: string | null;

  // Registration (email first, password after verification)
  register: (email: string) => Promise<void>;
  setPassword: (password: string) => Promise<void>;

  // Login
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Password reset
  sendPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;

  // Initialization
  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,
  pendingEmail: null,

  register: async (email: string) => {
    set({ isLoading: true });
    try {
      // Create user with temporary random password
      // Supabase will send confirmation email
      const tempPassword = crypto.randomUUID();

      const { error } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          emailRedirectTo: getRedirectUrl('/set-password'),
        },
      });
      if (error) throw error;
      set({ pendingEmail: email });
    } finally {
      set({ isLoading: false });
    }
  },

  setPassword: async (password: string) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      set({ pendingEmail: null });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ user: data.user, session: data.session });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, session: null });
    } finally {
      set({ isLoading: false });
    }
  },

  sendPasswordReset: async (email: string) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl('/reset-password'),
      });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (newPassword: string) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: async () => {
    try {
      // Set up auth state listener FIRST (before getSession)
      // This ensures we catch recovery/signup tokens from URL
      supabase.auth.onAuthStateChange((event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });

        // If this is a password recovery, we now have a session
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
        isInitialized: true,
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isInitialized: true });
    }
  },

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },
}));
