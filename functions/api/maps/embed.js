// Cloudflare Pages Function for Google Maps Embed URL
// Returns an embed URL for visual route verification

const ALLOWED_ORIGINS = [
  'https://dak.bkemper.me',
  'https://bkemper.me',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.find((o) => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=600',
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request);

  try {
    const { origin, destination, via } = await request.json();

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: 'origin and destination required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Build the Google Maps Embed API URL for directions
    // Format: https://www.google.com/maps/embed/v1/directions?key=KEY&origin=...&destination=...&waypoints=...
    const params = new URLSearchParams({
      key: env.GOOGLE_MAPS_API_KEY,
      origin,
      destination,
      mode: 'driving',
    });

    // Add waypoints if provided (pipe-separated coordinates)
    if (via && via.length) {
      const waypoints = via.map((v) => `${v.lat},${v.lng}`).join('|');
      params.set('waypoints', waypoints);
    }

    const embedUrl = `https://www.google.com/maps/embed/v1/directions?${params}`;

    return new Response(JSON.stringify({ embedUrl }), {
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
