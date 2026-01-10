// Cloudflare Pages Function for Google Places Autocomplete API
// Proxies requests to avoid CORS and keeps API key server-side

const ALLOWED_ORIGINS = [
  'https://bkemper.me',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.find(o => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const input = url.searchParams.get('input');

    if (!input) {
      return new Response(JSON.stringify({ error: 'input parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const params = new URLSearchParams({
      input,
      key: env.GOOGLE_MAPS_API_KEY,
      types: 'address',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return new Response(JSON.stringify({ error: data.status, details: data.error_message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Return simplified predictions
    const predictions = (data.predictions || []).map(p => ({
      description: p.description,
      placeId: p.place_id,
    }));

    return new Response(JSON.stringify({ predictions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}
