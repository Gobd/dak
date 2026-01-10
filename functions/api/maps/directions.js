// Cloudflare Pages Function for Google Directions API
// Returns route with specific waypoints to force a particular path

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

    const params = new URLSearchParams({
      origin,
      destination,
      key: env.GOOGLE_MAPS_API_KEY,
      departure_time: 'now',
      traffic_model: 'best_guess',
    });

    // Add waypoint to force route through specific road
    if (via) {
      params.set('waypoints', `via:${via}`);
    }

    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);

    const data = await response.json();

    if (data.status !== 'OK') {
      return new Response(JSON.stringify({ error: data.status, details: data.error_message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const route = data.routes[0];
    if (!route) {
      return new Response(JSON.stringify({ error: 'No route found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Sum up all legs (in case of waypoints)
    let totalDuration = 0;
    let totalDurationInTraffic = 0;
    let totalDistance = 0;

    for (const leg of route.legs) {
      totalDuration += leg.duration.value;
      totalDurationInTraffic += leg.duration_in_traffic?.value || leg.duration.value;
      totalDistance += leg.distance.value;
    }

    // Format duration text
    const formatDuration = (seconds) => {
      const mins = Math.round(seconds / 60);
      if (mins < 60) return `${mins} mins`;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hours} hr ${remainingMins} mins` : `${hours} hr`;
    };

    // Format distance text
    const formatDistance = (meters) => {
      const miles = meters / 1609.34;
      return `${miles.toFixed(1)} mi`;
    };

    const result = {
      summary: route.summary, // e.g., "via Highland Dr" or "via I-15 S"
      duration: formatDuration(totalDuration),
      durationValue: totalDuration,
      durationInTraffic: formatDuration(totalDurationInTraffic),
      durationInTrafficValue: totalDurationInTraffic,
      distance: formatDistance(totalDistance),
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
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}
