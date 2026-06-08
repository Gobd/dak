// Shared CORS utilities for Cloudflare Pages Functions
// Set ALLOWED_ORIGIN env var in Cloudflare (e.g., https://yourdomain.com)
// Set INTERNAL_API_KEY env var in Cloudflare + VITE_INTERNAL_API_KEY in frontend

// Check if origin is localhost (any port)
function isLocalhost(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function getCorsHeaders(request, env, options = {}) {
  const origin = request.headers.get('Origin') || '';

  // Allow any localhost port for dev, plus configured production origin
  const isAllowed = isLocalhost(origin) || (env?.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN);

  const allowedOrigin = isAllowed ? origin : env?.ALLOWED_ORIGIN || 'http://localhost:8080';

  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key',
  };

  // Optional caching for static data endpoints
  if (options.cacheSeconds) {
    headers['Cache-Control'] = `public, max-age=${options.cacheSeconds}`;
  }

  return headers;
}

export function handleOptions(request, env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, env),
  });
}

/**
 * Returns a 401 Response if the request is missing or has a wrong INTERNAL_API_KEY.
 * Returns null if the request is authorized (caller should proceed).
 * Skips check in local dev (no INTERNAL_API_KEY set) so dev workflow is unaffected.
 */
export function requireInternalAuth(request, env, corsHeaders) {
  if (!env?.INTERNAL_API_KEY) return null; // not configured — skip (local dev)

  const provided = request.headers.get('X-Internal-Key');
  if (provided === env.INTERNAL_API_KEY) return null;

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
