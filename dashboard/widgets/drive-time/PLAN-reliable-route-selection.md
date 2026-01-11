# Plan: Reliable Route Selection via Coordinates

## Problem

Current approach uses road names (e.g., "Highland Dr") as via points, extracted via regex or from route summary. This is fragile because:

- Road names may not uniquely identify a route
- Google may interpret the name differently than intended
- Regex extraction often fails, returning empty arrays

## Solution

Store lat/lng coordinates from the selected route instead of road names.

## Implementation Steps

### 1. Update alternatives.js backend

- Instead of extracting road names via regex, extract 1-2 lat/lng waypoints from each route
- Pick points from ~25% and ~75% along the route to capture the path's shape
- Return both the friendly `summary` (for display) and `waypointCoords` (for routing)

```js
// Example route response structure
{
  summary: "Highland Dr",           // For display only
  waypointCoords: [                 // For actual routing
    { lat: 32.8xxx, lng: -117.1xxx }
  ],
  duration: "25 mins",
  // ... other fields
}
```

### 2. Update drive-time.js frontend

#### Route storage format

Change `via` from string array to object array:

```js
// Before
via: ["Highland Dr"]

// After
via: [
  { lat: 32.8xxx, lng: -117.1xxx, label: "Highland Dr" }
]
```

#### Display logic

- Show friendly label: "via Highland Dr"
- Use coordinates when calling directions API

#### Migration

- Handle old string-based via arrays gracefully (treat as labels, re-select route to get coords)

### 3. Update directions.js backend

- Accept via points as either strings OR coordinate objects
- If coordinate object, format as `lat,lng` for Google API

```js
// Handle both formats
const formatVia = (v) => {
  if (typeof v === 'object' && v.lat && v.lng) {
    return `${v.lat},${v.lng}`;
  }
  return v; // string fallback
};
```

### 4. Update embed.js backend

- Same coordinate handling for map preview

## Files to Modify

- `functions/api/maps/alternatives.js` - Extract waypoint coords
- `functions/api/maps/directions.js` - Accept coord objects
- `functions/api/maps/embed.js` - Accept coord objects
- `dashboard/widgets/drive-time/drive-time.js` - Store/use coords

## Testing

1. Create new route, select alternative
2. Verify coords stored in localStorage
3. Verify map preview shows correct route
4. Verify traffic display uses correct route
5. Verify old string-based routes still work (degraded)
