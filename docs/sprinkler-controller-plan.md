# Sprinkler Controller - Implementation Plan

Smart sprinkler control integrating Zigbee soil moisture sensor with Rachio irrigation system.

## Concept

- Soil moisture sensor (Zigbee) in one zone determines watering needs
- Rachio controls the actual sprinkler zones
- Smart scheduling: base interval (every X days) adjusted by soil moisture
- Zone scaling: sensor zone determines duration, others scale proportionally

## Hardware

- **Soil Sensor**: Zigbee soil moisture/temperature sensor (e.g., [Amazon link](https://www.amazon.com/Soil-Moisture-Meter-Hygrometer-Temperature/dp/B0F7RFBRN7))
- **Sprinkler Controller**: Rachio (controlled via [rachiopy](https://github.com/rfverbruggen/rachiopy))

---

## Backend Structure (home-relay)

```
app/
  models/
    rachio.py       # Rachio device/zone models
    sprinkler.py    # Smart schedule models
  routers/
    rachio.py       # Rachio API endpoints
    sprinkler.py    # Smart schedule endpoints
  services/
    rachio_service.py    # Rachio cloud API wrapper
    sprinkler_service.py # Smart scheduling logic
```

### Rachio Service (`rachio_service.py`)

Wraps `rachiopy` library for Rachio cloud API.

**Endpoints:**
- `GET /rachio/devices` - List controllers
- `GET /rachio/zones` - List zones with status
- `POST /rachio/zone/start` - Run zone for X minutes
- `POST /rachio/zone/stop` - Stop zone
- `GET /rachio/schedules` - List Rachio schedules
- `POST /rachio/standby` - Enable/disable standby mode

### Sprinkler Service (`sprinkler_service.py`)

Smart scheduling logic.

- Reads soil sensor from existing `mqtt_service`
- Calculates scale factor from moisture
- Background scheduler thread for automated runs

**Endpoints:**
- `GET /sprinkler/status` - Current state, next run, moisture
- `GET /sprinkler/config` - Get schedule config
- `PUT /sprinkler/config` - Update config
- `POST /sprinkler/run-now` - Trigger immediate run
- `POST /sprinkler/skip` - Skip next scheduled run
- `POST /sprinkler/adjust` - Push schedule ±N days
- `GET /sprinkler/history` - Recent runs with moisture data

### Soil Sensor Integration

Extend `mqtt_service.py` to subscribe to soil sensors (similar to climate sensors).

Expected MQTT payload from `zigbee2mqtt/soil_sensor_xxx`:
```json
{
  "soil_moisture": 42,
  "temperature": 20,
  "battery": 85
}
```

---

## Config Shape

```json
{
  "sprinkler": {
    "rachio_api_key": "xxx",
    "device_id": "auto-detected",
    "sensor_device": "soil_sensor_zone4",
    "sensor_zone_index": 4,
    "zones": {
      "1": { "name": "Front Lawn", "base_minutes": 10, "enabled": true },
      "2": { "name": "Side Beds", "base_minutes": 15, "enabled": true },
      "3": { "name": "Back Lawn", "base_minutes": 8, "enabled": true },
      "4": { "name": "Garden (sensor)", "base_minutes": 12, "enabled": true }
    },
    "thresholds": {
      "skip_above": 70,
      "normal_range": [30, 50],
      "max_scale": 1.5,
      "min_scale": 0.5
    },
    "schedule": {
      "enabled": true,
      "mode": "smart",
      "start_time": "06:00",
      "interval_days": 3,
      "next_run": "2024-01-15T06:00:00"
    }
  }
}
```

---

## Scaling Algorithm

```python
def calculate_scale(moisture: float, thresholds: dict) -> float:
    """
    Calculate watering scale factor based on soil moisture.

    Returns:
        0.0 = skip entirely (too wet)
        0.5-1.0 = reduced watering (somewhat wet)
        1.0 = normal watering
        1.0-1.5 = extended watering (dry)
    """
    skip = thresholds["skip_above"]           # e.g., 70
    normal_max = thresholds["normal_range"][1]  # e.g., 50
    normal_min = thresholds["normal_range"][0]  # e.g., 30
    max_scale = thresholds["max_scale"]         # e.g., 1.5

    if moisture >= skip:
        return 0.0  # Skip entirely - soil is wet enough

    elif moisture > normal_max:
        # Interpolate 50-100% scale (wet but not skip-wet)
        return 0.5 + 0.5 * (skip - moisture) / (skip - normal_max)

    elif moisture >= normal_min:
        return 1.0  # Normal watering

    else:
        # Interpolate 100-150% scale (dry - need more water)
        return 1.0 + (max_scale - 1.0) * (normal_min - moisture) / normal_min
```

### Zone Duration Calculation

```python
def calculate_zone_durations(config: dict, scale: float) -> dict[str, int]:
    """
    Calculate actual run times for each zone.

    Sensor zone determines the scale, all zones scaled proportionally.
    """
    zones = config["zones"]
    sensor_zone = str(config["sensor_zone_index"])

    # Calculate sensor zone's scaled duration
    sensor_base = zones[sensor_zone]["base_minutes"]
    sensor_actual = sensor_base * scale

    # Scale all other zones proportionally
    durations = {}
    for zone_id, zone_config in zones.items():
        if not zone_config["enabled"]:
            continue
        base = zone_config["base_minutes"]
        durations[zone_id] = round(base * scale)

    return durations
```

---

## Frontend: Dashboard Widget (`Sprinkler.tsx`)

Frameless icon button (like Kasa widget) with modal for quick control.

### Widget Icon States
- 💧 Blue pulse: Currently watering
- 🌱 Green: Ready, soil moisture good
- 🏜️ Orange: Soil dry, watering soon
- 💤 Gray: Disabled/standby

### Modal UI

```
┌─────────────────────────────────────┐
│ 🌱 Sprinkler Control               │
├─────────────────────────────────────┤
│ Soil: 42% 🌡️ 68°F                   │
│ Status: Ready (scale: 100%)         │
│ Next run: Tomorrow 6:00am           │
├─────────────────────────────────────┤
│ [Water Now] [Skip] [+1 Day] [-1 Day]│
├─────────────────────────────────────┤
│ Mode: ○ Manual ○ Scheduled ● Smart  │
└─────────────────────────────────────┘
```

---

## Frontend: Standalone App (`sprinkler-controller/`)

Full configuration app with tabs (like `kasa-controller/`).

### Status Tab
- Current moisture/temp with trend graph
- Zone status (running/idle/last run)
- Recent run history with scale factors

### Zones Tab
- Configure each zone's base duration
- Enable/disable individual zones
- Designate sensor zone
- Test run individual zones

### Schedule Tab
- Mode selection:
  - **Manual**: Only run when user triggers
  - **Scheduled**: Fixed interval (every X days at Y time)
  - **Smart**: Moisture-adjusted scheduling
- Start time picker
- Interval days selector
- Threshold sliders with live preview of scale curve

### Settings Tab
- Rachio API key input
- Rachio device selection (if multiple)
- Sensor device selection (from Zigbee devices)
- Rain delay (skip for N days)

---

## Client Package (`packages/sprinkler-client/`)

Shared API wrapper following `kasa-client` pattern.

```typescript
export function createSprinklerClient(relayUrl: string) {
  return {
    // Status & Config
    getStatus(): Promise<SprinklerStatus>,
    getConfig(): Promise<SprinklerConfig>,
    updateConfig(config: Partial<SprinklerConfig>): Promise<SprinklerConfig>,

    // Schedule Control
    runNow(): Promise<RunResult>,
    skip(): Promise<void>,
    adjustDays(delta: number): Promise<void>,

    // History
    getHistory(limit?: number): Promise<RunHistory[]>,

    // Rachio Direct Control
    getZones(): Promise<RachioZone[]>,
    startZone(zoneId: string, minutes: number): Promise<void>,
    stopZone(zoneId: string): Promise<void>,
    setStandby(enabled: boolean): Promise<void>,
  };
}

// Types
interface SprinklerStatus {
  moisture: number;
  temperature: number;
  battery: number;
  scale: number;
  nextRun: string | null;
  mode: 'manual' | 'scheduled' | 'smart';
  running: boolean;
  currentZone: string | null;
}

interface SprinklerConfig {
  rachioApiKey: string;
  deviceId: string;
  sensorDevice: string;
  sensorZoneIndex: number;
  zones: Record<string, ZoneConfig>;
  thresholds: ThresholdConfig;
  schedule: ScheduleConfig;
}
```

---

## Implementation Order

1. **Backend: Rachio service** - Basic Rachio API wrapper, verify connectivity
2. **Backend: Soil sensor** - Extend MQTT service for soil moisture sensors
3. **Backend: Sprinkler service** - Smart scheduling logic with background thread
4. **API client generation** - Run `pnpm gen:api` to generate types
5. **Client package** - `packages/sprinkler-client/`
6. **Dashboard widget** - Quick status/control modal
7. **Standalone app** - Full configuration UI

---

## Weather Integration

Simple rain-skip logic. No need to predict heat - the soil sensor tells us when it's dry.

### Logic

```python
def should_skip_for_weather(forecast: dict, config: dict) -> tuple[bool, str]:
    """
    Check if we should skip watering due to weather.

    Returns (should_skip, reason)
    """
    threshold = config.get("rain_skip_threshold", 70)  # % chance
    rain_chance = forecast.get("precipitation_probability", 0)

    if rain_chance >= threshold:
        return True, f"Rain forecast ({rain_chance}%)"

    return False, ""
```

### Config

```json
{
  "sprinkler": {
    "weather": {
      "enabled": true,
      "rain_skip_threshold": 70
    }
  }
}
```

### UI

**Widget Status:**
- "Skipping - Rain forecast (85%)"
- Manual override button if user disagrees with skip

---

## Open Questions

1. **Rachio API limits?** - Need to check rate limits for cloud API
2. **Sensor reporting interval?** - How often does the Zigbee sensor report?
3. **Multiple sensors?** - Support for sensor per zone in the future?
4. **Notifications?** - Alert when watering skipped or soil critically dry?
5. **Weather source?** - Use existing dashboard weather API or separate call?
