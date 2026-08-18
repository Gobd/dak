# Plane Tracker

Nearby-aircraft alerts for a selected location profile. Thin client — all polling,
matching, and notification logic lives in home-relay; this app is just an easy-to-install
phone view.

## Features

- Live nearby aircraft (callsign, model, altitude, speed, distance, bearing) from adsb.fi
- Named location profiles with one active tracking location and ntfy topic at a time
- Geofence by radius (nm), with optional altitude ceilings per watch-list filter
- Watch list: alert on a specific aircraft (ICAO hex), a callsign prefix (e.g. military
  airlift callsigns), or an aircraft model/type code
- Push alerts via [ntfy](https://ntfy.sh) when a watch-listed aircraft enters the geofence
- Link to view any aircraft in more detail on [globe.adsb.fi](https://globe.adsb.fi)
- Installable as a PWA for quick access from a phone home screen
- One-tap current-location update from the main toolbar
- Automatic ADSB.lol to ADSB.fi provider fallback
- Dark/light mode

## Development

```bash
pnpm dev      # Start dev server on port 5182
```

Requires home-relay running with the `/planes/*` endpoints (set a relay URL in Settings
if not pointing at the default kiosk relay). Create or select a location profile in the
main toolbar, use the location button to update it, then add watch-list entries. Each profile
has its own ntfy topic; geofence, ntfy server, and watch-list settings are shared.
