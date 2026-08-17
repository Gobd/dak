# Plane Tracker

Nearby-aircraft alerts for a home geofence. Thin client — all polling, matching, and
notification logic lives in home-relay; this app is just an easy-to-install phone view.

## Features

- Live nearby aircraft (callsign, model, altitude, speed, distance, bearing) from adsb.fi
- Geofence by radius (nm) around a home lat/lon, with an optional altitude ceiling
- Watch list: alert on a specific aircraft (ICAO hex), a callsign prefix (e.g. military
  airlift callsigns), or an aircraft model/type code
- Push alerts via [ntfy](https://ntfy.sh) when a watch-listed aircraft enters the geofence
- Link to view any aircraft in more detail on [globe.adsb.fi](https://globe.adsb.fi)
- Installable as a PWA for quick access from a phone home screen
- Dark/light mode

## Development

```bash
pnpm dev      # Start dev server on port 5182
```

Requires home-relay running with the `/planes/*` endpoints (set a relay URL in Settings
if not pointing at the default kiosk relay). Set your home location once in Settings
(manually or via "Use my current location"), then add watch-list entries.
