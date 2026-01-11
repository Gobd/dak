// Cloudflare Pages Function for fetching route alternatives
// Returns multiple route options with summaries and extractable waypoints

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

// Extract key waypoints from a route's steps
// Picks major roads/highways to use as via points for locking in this route
function extractKeyWaypoints(route) {
  const waypoints = [];
  const seenRoads = new Set();

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      // Look for highway/major road references in the instructions
      const instruction = step.html_instructions || '';

      // Extract road names from instructions like "Merge onto I-15 S" or "Take Highland Dr"
      const roadPatterns = [
        /(?:onto|on|via|Take)\s+([A-Z]+-\d+[A-Z]?\s*[NSEW]?)/gi, // Highways like I-15 S, US-101
        /(?:onto|on|via|Take)\s+((?:State Route|SR|CA|US)\s*\d+)/gi, // State routes
        /(?:onto|on|via|Take)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Dr|Rd|Ave|Blvd|Hwy|St|Fwy|Pkwy|Way))/gi, // Named roads
      ];

      for (const pattern of roadPatterns) {
        const matches = instruction.matchAll(pattern);
        for (const match of matches) {
          const road = match[1].trim();
          if (!seenRoads.has(road.toLowerCase())) {
            seenRoads.add(road.toLowerCase());
            // Use the step's end location as the waypoint
            waypoints.push({
              name: road,
              location: step.end_location,
            });
          }
        }
      }
    }
  }

  // Return up to 3 key waypoints to avoid over-constraining
  // Prefer highways/interstates, then major roads
  const prioritized = waypoints.sort((a, b) => {
    const aIsHighway = /^[A-Z]+-\d+|^(?:I|US|SR|CA)-?\d+/i.test(a.name);
    const bIsHighway = /^[A-Z]+-\d+|^(?:I|US|SR|CA)-?\d+/i.test(b.name);
    if (aIsHighway && !bIsHighway) return -1;
    if (!aIsHighway && bIsHighway) return 1;
    return 0;
  });

  return prioritized.slice(0, 3);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const { origin, destination } = await request.json();

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
      alternatives: 'true', // Request multiple routes
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      return new Response(JSON.stringify({ error: data.status, details: data.error_message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!data.routes || data.routes.length === 0) {
      return new Response(JSON.stringify({ error: 'No routes found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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

    // Process each route alternative
    const routes = data.routes.map((route, index) => {
      let totalDuration = 0;
      let totalDurationInTraffic = 0;
      let totalDistance = 0;

      for (const leg of route.legs) {
        totalDuration += leg.duration.value;
        totalDurationInTraffic += leg.duration_in_traffic?.value || leg.duration.value;
        totalDistance += leg.distance.value;
      }

      // Extract waypoints that can be used to lock in this route
      const keyWaypoints = extractKeyWaypoints(route);

      return {
        index,
        summary: route.summary || `Route ${index + 1}`,
        duration: formatDuration(totalDuration),
        durationValue: totalDuration,
        durationInTraffic: formatDuration(totalDurationInTraffic),
        durationInTrafficValue: totalDurationInTraffic,
        distance: formatDistance(totalDistance),
        // Waypoints to use as "via" to lock in this route
        viaPoints: keyWaypoints.map((wp) => wp.name),
      };
    });

    return new Response(JSON.stringify({ routes }), {
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
