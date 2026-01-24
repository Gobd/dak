# @dak/kasa-client

React wrapper for Kasa smart plug API with hooks and utilities.

## Types

- `KasaDevice` - Device info and state
- `ScheduleRule` - Schedule configuration
- `ScheduleResponse` - Schedule API response
- `ToggleResponse` - Toggle API response

## Utilities

```ts
import {
  hasBrightness,
  hasEnergyMonitor,
  formatDuration,
  formatCountdown,
  formatScheduleTime,
} from '@dak/kasa-client';

if (hasBrightness(device)) {
  // Device supports dimming
}

if (hasEnergyMonitor(device)) {
  // Device has energy monitoring
}
```

## API Client

```ts
import { createKasaClient } from '@dak/kasa-client';

const client = createKasaClient({ baseUrl: 'http://localhost:5111' });
const devices = await client.getDevices();
```

## React Hooks

```ts
import { createKasaHooks, useKasaClient } from '@dak/kasa-client';

// In a component
const { useDevices, useToggle, useSchedules } = createKasaHooks(client);
const { data: devices } = useDevices();
```

## Constants

- `DAYS` - Day abbreviations array
- `DAY_LABELS` - Full day names
