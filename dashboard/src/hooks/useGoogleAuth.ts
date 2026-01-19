import { useState, useEffect, useCallback } from 'react';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = '386481992006-vc0ljc7cj1oefnd47mevvqgfd7d3rp0g.apps.googleusercontent.com';
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Token API - use env var for self-hosting, fallback to production
const APP_URL = import.meta.env.VITE_APP_URL || 'https://dak.bkemper.me';
const TOKEN_API = `${APP_URL}/api/oauth/token`;

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

interface UseGoogleAuthResult {
  isSignedIn: boolean;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
  isImplicitFlow: boolean;
}

const STORAGE_KEY = 'calendar-auth';

function loadStoredAuth(): AuthState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid stored auth
  }
  return null;
}

function saveAuth(auth: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

// Generate PKCE code verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hook for Google OAuth authentication
 * - Local dev: Uses implicit flow (token returned directly in URL)
 * - Production: Uses authorization code flow with PKCE (more secure)
 */
export function useGoogleAuth(): UseGoogleAuthResult {
  const [auth, setAuth] = useState<AuthState | null>(loadStoredAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if token is expired
  const isTokenExpired = auth?.expiresAt ? Date.now() > auth.expiresAt : true;
  const isSignedIn = !!auth?.accessToken && !isTokenExpired;

  // Handle OAuth callback
  useEffect(() => {
    // Check for implicit flow response (token in hash)
    if (window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

      if (accessToken) {
        const newAuth: AuthState = {
          accessToken,
          refreshToken: null, // Implicit flow doesn't provide refresh token
          expiresAt: Date.now() + expiresIn * 1000,
        };
        setAuth(newAuth);
        saveAuth(newAuth);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Check for authorization code flow response (code in query)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const storedVerifier = sessionStorage.getItem('oauth_code_verifier');

    if (code && storedVerifier) {
      exchangeCodeForToken(code, storedVerifier);
      // Clean up
      sessionStorage.removeItem('oauth_code_verifier');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Exchange authorization code for token (production flow)
  async function exchangeCodeForToken(code: string, codeVerifier: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(TOKEN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: window.location.origin + window.location.pathname,
          grant_type: 'authorization_code',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Token exchange failed');
      }

      const newAuth: AuthState = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };
      setAuth(newAuth);
      saveAuth(newAuth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  // Refresh token
  const refreshAccessToken = useCallback(async () => {
    if (!auth?.refreshToken) return false;

    try {
      const response = await fetch(TOKEN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: auth.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Refresh failed');
      }

      const newAuth: AuthState = {
        accessToken: data.access_token,
        refreshToken: auth.refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };
      setAuth(newAuth);
      saveAuth(newAuth);
      return true;
    } catch {
      // Refresh failed, need to re-authenticate
      clearAuth();
      setAuth(null);
      return false;
    }
  }, [auth?.refreshToken]);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!auth?.expiresAt || !auth?.refreshToken) return;

    // Refresh 5 minutes before expiry
    const refreshTime = auth.expiresAt - 5 * 60 * 1000 - Date.now();
    if (refreshTime <= 0) {
      refreshAccessToken();
      return;
    }

    const timer = setTimeout(refreshAccessToken, refreshTime);
    return () => clearTimeout(timer);
  }, [auth?.expiresAt, auth?.refreshToken, refreshAccessToken]);

  // Sign in
  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Client ID not configured');
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;

    if (isLocalDev) {
      // Implicit flow for local dev (simpler, no server needed)
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: CALENDAR_SCOPES,
        include_granted_scopes: 'true',
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else {
      // Authorization code flow with PKCE for production
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store verifier for later exchange
      sessionStorage.setItem('oauth_code_verifier', codeVerifier);

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: CALENDAR_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
  }, []);

  // Sign out
  const signOut = useCallback(() => {
    clearAuth();
    setAuth(null);
    setError(null);
  }, []);

  return {
    isSignedIn,
    accessToken: isSignedIn ? auth?.accessToken || null : null,
    loading,
    error,
    signIn,
    signOut,
    isImplicitFlow: isLocalDev,
  };
}

/**
 * Fetch from Google Calendar API with authentication
 */
export async function fetchCalendarApi<T>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  return response.json();
}
