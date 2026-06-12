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

  if (!oauthToken) {
    return new Response(JSON.stringify({ error: 'No OAuth token provided' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${oauthToken}`);
  headers.set('User-Agent', 'web:dak-reddit-gallery:v1.0.0 (by /u/dev)');
  headers.set('Accept', 'application/json');

  const isUser = url.searchParams.get('target') === 'user';
  url.searchParams.delete('target');
  const targetUrl = `https://oauth.reddit.com/${isUser ? 'user' : 'r'}/${subPath}${url.search}`;

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
