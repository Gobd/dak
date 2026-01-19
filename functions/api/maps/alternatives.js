// Cloudflare Pages Function for fetching route alternatives
// Returns multiple route options with summaries and extractable waypoints

import { getCorsHeaders, handleOptions } from '../_cors.js';

// Extract waypoint coordinates along the route for reliable locking
// Number of waypoints scales with route length to avoid clustering on short routes
function extractWaypointCoords(route) {
  // Collect all step end locations with cumulative distance
  const points = [];
  let cumulativeDistance = 0;

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      cumulativeDistance += step.distance.value;
      points.push({
        location: step.end_location,
        distance: cumulativeDistance,
      });
    }
  }

  if (points.length === 0) return [];

  const totalDistance = cumulativeDistance;

  // Scale waypoint count based on route length
  // < 3 mi (5km): 1 waypoint
  // 3-12 mi (5-20km): 2 waypoints
  // 12-40 mi (20-65km): 3 waypoints
  // > 40 mi (65km): 4 waypoints
  let targetPercentages;
  if (totalDistance < 5000) {
    targetPercentages = [0.5];
  } else if (totalDistance < 20000) {
    targetPercentages = [0.33, 0.66];
  } else if (totalDistance < 65000) {
    targetPercentages = [0.25, 0.5, 0.75];
  } else {
    targetPercentages = [0.2, 0.4, 0.6, 0.8];
  }

  const waypoints = [];

  for (const pct of targetPercentages) {
    const targetDistance = totalDistance * pct;
    // Find the point closest to this percentage
    let closest = points[0];
    let closestDiff = Math.abs(points[0].distance - targetDistance);

    for (const point of points) {
      const diff = Math.abs(point.distance - targetDistance);
      if (diff < closestDiff) {
        closest = point;
        closestDiff = diff;
      }
    }

    waypoints.push({
      lat: closest.location.lat,
      lng: closest.location.lng,
    });
  }

  return waypoints;
}

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

      // Extract lat/lng waypoints at 25%, 50%, 75% of route for reliable locking
      const waypointCoords = extractWaypointCoords(route);

      return {
        index,
        summary: route.summary || `Route ${index + 1}`,
        duration: formatDuration(totalDuration),
        durationValue: totalDuration,
        durationInTraffic: formatDuration(totalDurationInTraffic),
        durationInTrafficValue: totalDurationInTraffic,
        distance: formatDistance(totalDistance),
        // Lat/lng coordinates to lock in this specific route
        waypointCoords,
        // Keep viaPoints empty for backwards compat, coords are the real data now
        viaPoints: [],
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
  return handleOptions(context.request, context.env);
}
