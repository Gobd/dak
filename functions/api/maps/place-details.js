// Cloudflare Pages Function for Google Place Details API
// Returns structured address components (city, state) from a placeId

const ALLOWED_ORIGINS = [
  'https://dak.bkemper.me',
  'https://bkemper.me',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.find((o) => origin.startsWith(o))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=86400',
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const placeId = url.searchParams.get('placeId');

    if (!placeId) {
      return new Response(JSON.stringify({ error: 'placeId parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const params = new URLSearchParams({
      place_id: placeId,
      key: env.GOOGLE_MAPS_API_KEY,
      fields: 'address_components,geometry',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );

    const data = await response.json();

    if (data.status !== 'OK') {
      return new Response(JSON.stringify({ error: data.status, details: data.error_message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Extract city and state from address components
    const components = data.result?.address_components || [];
    let city = '';
    let state = '';
    let lat = null;
    let lon = null;

    for (const comp of components) {
      if (comp.types.includes('locality')) {
        city = comp.long_name;
      } else if (!city && comp.types.includes('sublocality_level_1')) {
        city = comp.long_name;
      } else if (!city && comp.types.includes('administrative_area_level_2')) {
        // County as fallback for city
        city = comp.long_name;
      }
      if (comp.types.includes('administrative_area_level_1')) {
        state = comp.short_name; // e.g., "CA" not "California"
      }
    }

    // Get coordinates
    if (data.result?.geometry?.location) {
      lat = data.result.geometry.location.lat;
      lon = data.result.geometry.location.lng;
    }

    return new Response(JSON.stringify({ city, state, lat, lon }), {
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
