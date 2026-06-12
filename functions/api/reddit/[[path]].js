import { getCorsHeaders, handleOptions } from '../_cors.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return handleOptions(request, env);

  const corsHeaders = getCorsHeaders(request, env);

  // Validate our own API key (separate from INTERNAL_API_KEY used by other functions)
  if (env.REDDIT_API_KEY) {
    const provided = request.headers.get('X-Reddit-Key');
    if (provided !== env.REDDIT_API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  const url = new URL(request.url);

  // context.params.path is an array like ['pics', 'hot'] or ['pics+aww']
  const pathParts = context.params.path ?? [];
  const subPath = Array.isArray(pathParts) ? pathParts.join('/') : pathParts;

  const oauthToken = request.headers.get('X-Reddit-Token');

  let targetBase;
  const headers = new Headers();

  if (oauthToken) {
    targetBase = 'https://oauth.reddit.com';
    headers.set('Authorization', `Bearer ${oauthToken}`);
    headers.set('User-Agent', 'web:dak-reddit-gallery:v1.0.0 (by /u/dev)');
  } else {
    targetBase = 'https://www.reddit.com';
    const incomingUA = request.headers.get('User-Agent');
    headers.set(
      'User-Agent',
      incomingUA ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    );
  }

  headers.set('Accept', 'application/json');

  const suffix = oauthToken ? '' : '.json';
  const isUser = url.searchParams.get('target') === 'user';
  url.searchParams.delete('target');
  const targetUrl = `${targetBase}/${isUser ? 'user' : 'r'}/${subPath}${suffix}${url.search}`;

  const response = await fetch(targetUrl, { headers });

  if (!response.ok) {
    const body = await response.text();
    return new Response(
      JSON.stringify({ error: `Reddit returned ${response.status}`, details: body.slice(0, 250) }),
      {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }

  const data = await response.arrayBuffer();

  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
