# Climate Display

Dedicated display for indoor/outdoor temperature and humidity comparison. Designed for wall-mounted tablets.

## Features

- Real-time sensor data from Zigbee2MQTT via home-relay
- Indoor/outdoor temperature and humidity
- "Feels like" temperature
- Trend indicators (rising, falling, stable)
- Comparison banner (cooler/warmer outside)
- Temperature unit toggle (C/F)
- Battery status warnings
- Dark/light mode

## Development

```bash
pnpm dev      # Start dev server on port 5175
```

Requires home-relay running with Zigbee2MQTT sensor data.
