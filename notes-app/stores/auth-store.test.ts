import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import { useAuthStore } from './auth-store';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isInitialized: false,
      pendingEmail: null,
    });
  });

  it('should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
    expect(state.pendingEmail).toBeNull();
  });

  it('should set session correctly', () => {
    const mockSession = {
      access_token: 'test-token',
      user: { id: '123', email: 'test@example.com' },
    };

    useAuthStore.getState().setSession(mockSession as unknown as Session);

    const state = useAuthStore.getState();
    expect(state.session).toEqual(mockSession);
    expect(state.user).toEqual(mockSession.user);
  });

  it('should clear session on null', () => {
    // Set initial session
    useAuthStore.setState({
      session: { access_token: 'test' } as unknown as Session,
      user: { id: '123' } as unknown as User,
    });

    // Clear session
    useAuthStore.getState().setSession(null);

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
  });
});
