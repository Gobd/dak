// Cloudflare Pages Function for Google Places Autocomplete API
// Proxies requests to avoid CORS and keeps API key server-side

import { getCorsHeaders, handleOptions } from '../_cors.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request, env);

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
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    );

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return new Response(JSON.stringify({ error: data.status, details: data.error_message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Return simplified predictions
    const predictions = (data.predictions || []).map((p) => ({
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
  return handleOptions(context.request, context.env);
}
