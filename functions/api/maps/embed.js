// Cloudflare Pages Function for Google Maps Embed URL
// Returns an embed URL for visual route verification

import { getCorsHeaders, handleOptions } from '../_cors.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request, env);

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
  return handleOptions(context.request, context.env);
}
