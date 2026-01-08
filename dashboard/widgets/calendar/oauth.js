// Google OAuth for Calendar Widget
// Uses implicit flow (client-side only)

const STORAGE_KEY = 'google-auth';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

const CLIENT_ID = '696255640250-ha91c7enlsravhptab5c63punfunlh8u.apps.googleusercontent.com';

export function getStoredAuth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const auth = JSON.parse(stored);

    // Check if token is expired
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return auth;
  } catch {
    return null;
  }
}

export function storeAuth(accessToken, expiresIn) {
  const auth = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  return auth;
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthUrl() {
  const redirectUri = window.location.origin + window.location.pathname;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function handleOAuthCallback() {
  // Check if we have an OAuth response in the URL hash
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) {
    return null;
  }

  // Parse the hash fragment
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

  if (accessToken) {
    // Store the token
    const auth = storeAuth(accessToken, expiresIn);

    // Clear the hash from URL
    history.replaceState(null, '', window.location.pathname + window.location.search);

    return auth;
  }

  return null;
}

export function isConfigured() {
  return CLIENT_ID && !CLIENT_ID.includes('YOUR_CLIENT_ID');
}
