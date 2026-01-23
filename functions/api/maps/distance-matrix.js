// Cloudflare Pages Function for Google Distance Matrix API
// Proxies requests to avoid CORS and keeps API key server-side

import { getCorsHeaders, handleOptions } from '../_cors.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request, env);

  try {
    const { origin, destination } = await request.json();

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: 'origin and destination required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const params = new URLSearchParams({
      origins: origin,
      destinations: destination,
      key: env.GOOGLE_MAPS_API_KEY,
      departure_time: 'now',
      traffic_model: 'best_guess',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
    );

    const data = await response.json();

    if (data.status !== 'OK') {
      return new Response(JSON.stringify({ error: data.status, details: data.error_message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      return new Response(JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Return simplified response
    const result = {
      duration: element.duration.text,
      durationValue: element.duration.value,
      durationInTraffic: element.duration_in_traffic?.text || element.duration.text,
      durationInTrafficValue: element.duration_in_traffic?.value || element.duration.value,
      distance: element.distance.text,
    };

    return new Response(JSON.stringify(result), {
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
