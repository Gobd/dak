// Google OAuth for Calendar Widget
// Uses Authorization Code flow with PKCE
// Token exchange happens server-side via Cloudflare Function

const STORAGE_KEY = 'google-auth';
const VERIFIER_KEY = 'google-auth-verifier';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

// Dev mode detection
export function isDevMode() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// Get auth URL for dev mode (implicit flow - no server needed)
export function getDevAuthUrl() {
  const redirectUri = window.location.origin + window.location.pathname;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token', // Implicit flow - token returned directly
    scope: SCOPES,
    prompt: 'select_account', // Let user pick account
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Handle implicit flow callback (token in URL hash)
export function handleDevCallback() {
  if (!isDevMode()) return null;

  // Check for token in URL hash (implicit flow returns #access_token=xxx&expires_in=3600&...)
  const hash = window.location.hash.substring(1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');

  if (!accessToken) return null;

  // Store token
  const auth = storeAuth(accessToken, Number(expiresIn) || 3600, null);

  // Clear hash from URL
  history.replaceState(null, '', window.location.pathname);

  return auth;
}

// Set a dev token manually (call from console or paste UI)
export function setDevToken(accessToken) {
  const auth = {
    accessToken,
    expiresAt: Date.now() + 3600 * 1000, // 1 hour
    refreshToken: null,
    isDev: true,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  window.location.reload();
}

const CLIENT_ID = '386481992006-vc0ljc7cj1oefnd47mevvqgfd7d3rp0g.apps.googleusercontent.com';
const TOKEN_ENDPOINT = '/api/oauth/token';

// Generate cryptographically random string for PKCE
function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Create SHA-256 hash and base64url encode for code challenge
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  // Convert to base64url format
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getStoredAuth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const auth = JSON.parse(stored);

    // If we have a refresh token, we can always refresh - don't check expiry here
    if (auth.refreshToken) {
      return auth;
    }

    // Legacy: if no refresh token, check expiry
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return auth;
  } catch {
    return null;
  }
}

export function storeAuth(accessToken, expiresIn, refreshToken = null) {
  const existing = getStoredAuth();
  const auth = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    // Keep existing refresh token if not provided (happens during refresh)
    refreshToken: refreshToken || existing?.refreshToken || null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  return auth;
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
}

export async function getAuthUrl() {
  const redirectUri = window.location.origin + window.location.pathname;

  // Generate and store code verifier for PKCE
  const codeVerifier = generateRandomString(64);
  localStorage.setItem(VERIFIER_KEY, codeVerifier);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent to ensure refresh token is returned
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for tokens via Cloudflare Function
async function exchangeCodeForTokens(code) {
  const redirectUri = window.location.origin + window.location.pathname;
  const codeVerifier = localStorage.getItem(VERIFIER_KEY);

  if (!codeVerifier) {
    throw new Error('No code verifier found');
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Token exchange failed');
  }

  const tokens = await response.json();

  // Clean up verifier
  localStorage.removeItem(VERIFIER_KEY);

  return tokens;
}

// Refresh access token using refresh token via Cloudflare Function
export async function refreshAccessToken() {
  const auth = getStoredAuth();
  if (!auth?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: auth.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    // If refresh token is invalid/revoked, clear auth
    if (error.error === 'invalid_grant') {
      clearAuth();
      throw new Error('AUTH_REVOKED');
    }
    throw new Error(error.error_description || error.error || 'Token refresh failed');
  }

  const tokens = await response.json();

  // Store new access token (refresh token stays the same)
  return storeAuth(tokens.access_token, tokens.expires_in);
}

// Check if access token is expired or about to expire (within 5 minutes)
export function isTokenExpired() {
  const auth = getStoredAuth();
  if (!auth?.expiresAt) return true;
  // Consider expired if within 5 minutes of expiry
  return Date.now() > auth.expiresAt - 5 * 60 * 1000;
}

// Get a valid access token, refreshing if necessary
export async function getValidAccessToken() {
  const auth = getStoredAuth();
  if (!auth) return null;

  if (isTokenExpired() && auth.refreshToken) {
    try {
      const newAuth = await refreshAccessToken();
      return newAuth.accessToken;
    } catch (err) {
      if (err.message === 'AUTH_REVOKED') {
        return null;
      }
      throw err;
    }
  }

  return auth.accessToken;
}

export async function handleOAuthCallback() {
  // Check if we have an authorization code in the URL
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (!code) {
    return null;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens
    const auth = storeAuth(tokens.access_token, tokens.expires_in, tokens.refresh_token);

    // Clear the code from URL
    const cleanUrl = window.location.pathname;
    history.replaceState(null, '', cleanUrl);

    return auth;
  } catch (err) {
    console.error('OAuth callback error:', err);
    // Clear the code from URL even on error
    history.replaceState(null, '', window.location.pathname);
    return null;
  }
}

export function isConfigured() {
  return CLIENT_ID && !CLIENT_ID.includes('YOUR_CLIENT_ID');
}

// Check if we have a refresh token (for indefinite auth)
export function hasRefreshToken() {
  const auth = getStoredAuth();
  return !!auth?.refreshToken;
}
