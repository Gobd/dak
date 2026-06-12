import { getCorsHeaders, handleOptions } from './_cors.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return handleOptions(request, env);

  const corsHeaders = getCorsHeaders(request, env);

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
  const q = url.searchParams.get('q') ?? '';
  const nsfw = url.searchParams.get('nsfw') === '1' ? '1' : '0';

  if (!q.trim()) {
    return new Response(JSON.stringify({ subreddits: [] }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const oauthToken = request.headers.get('X-Reddit-Token');

  if (!oauthToken) {
    return new Response(JSON.stringify({ subreddits: [] }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${oauthToken}`);
  headers.set('User-Agent', 'web:dak-reddit-gallery:v1.0.0 (by /u/dev)');
  headers.set('Accept', 'application/json');

  const targetUrl = `https://oauth.reddit.com/subreddits/search?q=${encodeURIComponent(q)}&include_over_18=${nsfw}&limit=8&sort=relevance`;

  const response = await fetch(targetUrl, { headers });

  if (!response.ok) {
    return new Response(JSON.stringify({ subreddits: [] }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const json = await response.json();
  const subreddits = (json?.data?.children ?? []).map((c) => ({
    name: c.data.display_name,
    title: c.data.title,
    subscribers: c.data.subscribers,
    over18: c.data.over18,
    icon: c.data.icon_img || c.data.community_icon || null,
  }));

  return new Response(JSON.stringify({ subreddits }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
