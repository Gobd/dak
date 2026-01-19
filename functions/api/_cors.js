// Shared CORS utilities for Cloudflare Pages Functions
// Set ALLOWED_ORIGIN env var in Cloudflare (e.g., https://yourdomain.com)

const LOCALHOST_ORIGINS = ['http://localhost:8080', 'http://127.0.0.1:8080'];

export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';

  // Build allowed origins list from env var + localhost for dev
  const allowedOrigins = env?.ALLOWED_ORIGIN
    ? [env.ALLOWED_ORIGIN, ...LOCALHOST_ORIGINS]
    : LOCALHOST_ORIGINS;

  const allowedOrigin = allowedOrigins.find((o) => origin.startsWith(o)) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=600',
  };
}

export function handleOptions(request, env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, env),
  });
}
