# Indoor/Outdoor Climate Comparison Feature

Display indoor vs outdoor temperature and humidity with trend arrows, and show which "feels" cooler or warmer.

## Hardware to Buy

| Item | Product | Est. Cost | Notes |
|------|---------|-----------|-------|
| Zigbee USB Coordinator | [SONOFF Zigbee 3.0 Dongle-P (EFR32MG24)](https://www.amazon.com/dp/B0FMJD288B) | ~$35 | EFR32MG24 chip, best range, future-proof |
| Indoor Sensor | [Aqara Temperature & Humidity Sensor](https://www.amazon.com/dp/B07D37FKGY) | ~$20 | Model WSDCGQ11LM, well-loved |
| Outdoor Sensor | [Aqara Temperature & Humidity Sensor](https://www.amazon.com/dp/B07D37FKGY) | ~$20 | Same sensor, DIY weatherproof |
| Optional: Range Extender | [SONOFF S31 Lite Zigbee Plug](https://www.amazon.com/dp/B08X2944W7) | ~$12 | Place near window facing outdoor sensor |

**Total: ~$75-87**

### Outdoor Sensor Weatherproofing

**Option A: DIY (free/$5)**
- Cover the LED hole with waterproof tape (electrical tape, Gorilla tape, etc.)
- Mount sensor-hole-down so rain drains away
- Place under eave/overhang to keep out of direct rain
- Many people report years of outdoor use this way

**Option B: Enclosure (~$10-15)**
- [Sensor Weather Shield](https://www.amazon.com/dp/B0BRNS4J8Z) or similar
- Vented to allow airflow while blocking rain
- Better for fully exposed locations

---

## Zigbee Range

| Condition | Typical Range |
|-----------|---------------|
| Line of sight (outdoor, no walls) | 50-100m (~150-300ft) |
| Through 1-2 interior walls | 10-20m (~30-60ft) |
| Through exterior wall | 5-15m (~15-50ft) |
| Through brick/concrete | 5-10m (~15-30ft) |

**Key points:**
- Zigbee is a **mesh network** - any mains-powered device (smart plugs, bulbs) acts as a repeater
- Battery-powered sensors (like Aqara) do NOT repeat - they're "end devices"
- If outdoor sensor struggles, add a Zigbee smart plug near the window facing it

**For your 100ft outdoor placement:**
- Probably works if sensor is visible from window/RPi location
- May need a repeater plug near the window if there are walls in the way
- Test first before buying extra hardware

---

## What Gets Displayed

```
┌─────────────────────────────────────────────────────────────┐
│  Climate                                    [☀️ Cooling]     │
├─────────────────────────┬───────────────────────────────────┤
│  Indoor                 │  Outdoor                          │
│  ───────                │  ────────                         │
│  Temp     23.5°C  ↑     │  Temp     18.2°C  ↓               │
│  Humidity 45%     →     │  Humidity 65%     ↑               │
│  Feels    23.2°C        │  Feels    17.8°C                  │
├─────────────────────────┴───────────────────────────────────┤
│                         ❄️                                   │
│         Open windows - outside feels 5.4° cooler            │
└─────────────────────────────────────────────────────────────┘
```

**Trend arrows:**
- `↑` Rising - current value > recent average + threshold
- `↓` Falling - current value < recent average - threshold
- `→` Steady - within threshold of recent average

**Thresholds:** Temp ±0.5°C, Humidity ±2%

---

## Season Mode Setting

Toggle between cooling (summer) and heating (winter) mode to change window recommendations.

| Mode | Setting | Open windows when... |
|------|---------|----------------------|
| ☀️ Cooling | `wantCooler: true` | Outside feels **cooler** |
| ❄️ Heating | `wantCooler: false` | Outside feels **warmer** |

**Storage:** Widget setting stored in `panel.args.wantCooler` (boolean, default `true`)

**UI:** Clickable toggle button in widget header - tap to switch modes

**Examples:**
- Summer, 75°F inside, 65°F outside → "Open windows" (cooling mode)
- Summer, 75°F inside, 85°F outside → "Keep closed" (cooling mode)
- Winter, 65°F inside, 55°F outside → "Keep closed" (heating mode)
- Winter, 65°F inside, 70°F outside → "Open windows" (heating mode)

---

## System Architecture

```
┌──────────────┐    Zigbee    ┌──────────────┐
│ Aqara Indoor │◄────────────►│              │
└──────────────┘              │   USB        │    USB     ┌─────────────┐
                              │   Dongle     │◄──────────►│     RPi     │
┌──────────────┐              │   (CC2652)   │            │             │
│Aqara Outdoor │◄────────────►│              │            │ Zigbee2MQTT │
└──────────────┘    Zigbee    └──────────────┘            │      ↓      │
                                                          │   MQTT      │
                                                          │      ↓      │
                                                          │ home-relay  │
                                                          │      ↓      │
                                                          │  Dashboard  │
                                                          └─────────────┘
```

---

## Implementation Plan

### Phase 1: Zigbee Setup Script (separate, optional)

**New file:** `scripts/zigbee-setup.sh`

Run this after plugging in the Zigbee USB dongle. Separate from main kiosk-setup.sh so it's optional.

```bash
#!/bin/bash
# Zigbee setup script for climate sensors
# Run after plugging in Zigbee USB dongle:
#   bash ~/dashboard/scripts/zigbee-setup.sh

set -e

# Check for Zigbee dongle
if ! ls /dev/ttyUSB* /dev/ttyACM* &>/dev/null; then
  echo "ERROR: No Zigbee USB dongle detected"
  echo "Plug in your SONOFF Zigbee dongle and try again"
  exit 1
fi

SERIAL_PORT=$(ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null | head -1)
echo "=== Found Zigbee dongle at $SERIAL_PORT ==="

echo "=== Installing Mosquitto (MQTT broker) ==="
sudo apt-get update
sudo apt-get install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

echo "=== Installing Node.js 24 for Zigbee2MQTT ==="
if ! command -v node &>/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "=== Installing Zigbee2MQTT ==="
if [ ! -d /opt/zigbee2mqtt ]; then
  sudo mkdir -p /opt/zigbee2mqtt
  sudo chown -R "$USER:$USER" /opt/zigbee2mqtt
  git clone --depth 1 https://github.com/Koenkk/zigbee2mqtt.git /opt/zigbee2mqtt
  cd /opt/zigbee2mqtt && npm ci
fi

mkdir -p /opt/zigbee2mqtt/data
cat > /opt/zigbee2mqtt/data/configuration.yaml << EOF
homeassistant: false
permit_join: false
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://localhost
serial:
  port: $SERIAL_PORT
frontend:
  port: 8080
advanced:
  log_level: warn
  network_key: GENERATE
EOF

sudo usermod -a -G dialout "$USER"

sudo tee /etc/systemd/system/zigbee2mqtt.service > /dev/null << EOF
[Unit]
Description=Zigbee2MQTT
After=network.target mosquitto.service
Requires=mosquitto.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/zigbee2mqtt
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable zigbee2mqtt
sudo systemctl start zigbee2mqtt

echo ""
echo "=== Zigbee setup complete! ==="
echo "Zigbee2MQTT web UI: http://localhost:8080"
echo ""
echo "Next steps:"
echo "1. Open http://$(hostname).local:8080"
echo "2. Edit configuration, set permit_join: true"
echo "3. Hold sensor button 5s to pair"
echo "4. Set friendly_name to 'indoor_climate' or 'outdoor_climate'"
echo "5. Set permit_join: false when done"
```

---

### Phase 2: Backend - Sensor Routes

**New file:** `services/home-relay/routes/sensors.py`

```python
"""
Indoor/outdoor climate sensor routes.
Subscribes to Zigbee2MQTT via MQTT, tracks history for trends.
"""

import json
import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from flask import Blueprint, jsonify, request

import paho.mqtt.client as mqtt

sensors_bp = Blueprint("sensors", __name__, url_prefix="/sensors")

# Config - update these after pairing sensors
MQTT_HOST = "localhost"
MQTT_PORT = 1883
INDOOR_TOPIC = "zigbee2mqtt/indoor_climate"
OUTDOOR_TOPIC = "zigbee2mqtt/outdoor_climate"
HISTORY_SIZE = 30
TREND_WINDOW = 5


@dataclass
class SensorReading:
    temperature: float = 0.0
    humidity: float = 0.0
    battery: int = 100
    timestamp: float = 0.0


@dataclass
class SensorData:
    current: SensorReading = field(default_factory=SensorReading)
    history: deque = field(default_factory=lambda: deque(maxlen=HISTORY_SIZE))


sensors: dict[str, SensorData] = {
    "indoor": SensorData(),
    "outdoor": SensorData(),
}

mqtt_client: mqtt.Client | None = None
mqtt_connected = False


def feels_like(temp_c: float, humidity: float) -> float:
    """Calculate feels-like temperature (heat index for warm, humidity-adjusted for cool)."""
    temp_f = temp_c * 9/5 + 32

    if temp_f >= 80 and humidity >= 40:
        # Heat index formula
        hi = (-42.379 + 2.04901523*temp_f + 10.14333127*humidity
              - 0.22475541*temp_f*humidity - 0.00683783*temp_f**2
              - 0.05481717*humidity**2 + 0.00122874*temp_f**2*humidity
              + 0.00085282*temp_f*humidity**2 - 0.00000199*temp_f**2*humidity**2)
        return (hi - 32) * 5/9

    # For cooler temps, blend with dew point influence
    if humidity <= 0:
        return temp_c
    a, b = 17.62, 243.12
    gamma = math.log(humidity / 100) + (a * temp_c) / (b + temp_c)
    dew_point = (b * gamma) / (a - gamma)
    return temp_c + (dew_point - temp_c) * 0.1


def get_trend(current: float, history: deque, attr: str) -> str:
    """Calculate trend: 'rising', 'falling', or 'steady'."""
    if len(history) < TREND_WINDOW:
        return "steady"

    recent = list(history)[-TREND_WINDOW:]
    avg = sum(getattr(r, attr) for r in recent) / len(recent)
    diff = current - avg
    threshold = 0.5 if attr == "temperature" else 2.0

    if diff > threshold:
        return "rising"
    elif diff < -threshold:
        return "falling"
    return "steady"


def on_connect(client, userdata, flags, rc, properties=None):
    global mqtt_connected
    mqtt_connected = rc == 0
    if mqtt_connected:
        client.subscribe(INDOOR_TOPIC)
        client.subscribe(OUTDOOR_TOPIC)
        print(f"[sensors] MQTT connected")


def on_disconnect(client, userdata, rc, properties=None):
    global mqtt_connected
    mqtt_connected = False


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        key = "indoor" if msg.topic == INDOOR_TOPIC else "outdoor" if msg.topic == OUTDOOR_TOPIC else None
        if not key:
            return

        reading = SensorReading(
            temperature=data.get("temperature", 0),
            humidity=data.get("humidity", 0),
            battery=data.get("battery", 100),
            timestamp=time.time(),
        )
        sensors[key].history.append(reading)
        sensors[key].current = reading
    except Exception as e:
        print(f"[sensors] Error: {e}")


def start_mqtt():
    global mqtt_client
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message

    def loop():
        while True:
            try:
                mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
                mqtt_client.loop_forever()
            except Exception as e:
                print(f"[sensors] MQTT reconnecting: {e}")
                time.sleep(5)

    threading.Thread(target=loop, daemon=True).start()


def sensor_response(key: str) -> dict:
    s = sensors[key]
    c = s.current

    if c.timestamp == 0:
        return {"available": False, "error": "No data yet"}

    return {
        "available": True,
        "temperature": round(c.temperature, 1),
        "humidity": round(c.humidity, 1),
        "feels_like": round(feels_like(c.temperature, c.humidity), 1),
        "temperature_trend": get_trend(c.temperature, s.history, "temperature"),
        "humidity_trend": get_trend(c.humidity, s.history, "humidity"),
        "battery": c.battery,
        "age_seconds": round(time.time() - c.timestamp),
    }


@sensors_bp.route("/status")
def status():
    return jsonify({"mqtt_connected": mqtt_connected})


@sensors_bp.route("/indoor")
def indoor():
    return jsonify(sensor_response("indoor"))


@sensors_bp.route("/outdoor")
def outdoor():
    return jsonify(sensor_response("outdoor"))


@sensors_bp.route("/all")
def all_sensors():
    ind = sensor_response("indoor")
    out = sensor_response("outdoor")

    comparison = None
    if ind.get("available") and out.get("available"):
        diff = out["feels_like"] - ind["feels_like"]
        comparison = {
            "outside_feels_cooler": diff < -0.5,
            "outside_feels_warmer": diff > 0.5,
            "difference": round(diff, 1),
        }

    return jsonify({"indoor": ind, "outdoor": out, "comparison": comparison})


start_mqtt()
```

**Update:** `services/home-relay/relay.py`

```python
# Add import
from routes.sensors import sensors_bp

# Register blueprint
app.register_blueprint(sensors_bp)
```

**Update:** `services/home-relay/pyproject.toml`

```toml
dependencies = [
    # ... existing ...
    "paho-mqtt>=2.0.0",
]
```

---

### Phase 3: Frontend - Climate Widget

**Update:** `src/types.ts`

Add `'climate'` to the `WidgetType` union.

**New file:** `src/components/widgets/Climate.tsx`

```tsx
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { useConfigStore } from '../../stores/config-store';
import type { Panel } from '../../types';

interface SensorData {
  available: boolean;
  temperature: number;
  humidity: number;
  feels_like: number;
  temperature_trend: 'rising' | 'falling' | 'steady';
  humidity_trend: 'rising' | 'falling' | 'steady';
  battery: number;
  error?: string;
}

interface ClimateData {
  indoor: SensorData;
  outdoor: SensorData;
  comparison: {
    outside_feels_cooler: boolean;
    outside_feels_warmer: boolean;
    difference: number;
  } | null;
}

const TREND = {
  rising: { icon: '↑', color: 'text-red-400' },
  falling: { icon: '↓', color: 'text-blue-400' },
  steady: { icon: '→', color: 'text-gray-400' },
} as const;

function Trend({ trend, value, unit }: { trend: keyof typeof TREND; value: number; unit: string }) {
  const { icon, color } = TREND[trend];
  return (
    <span className="inline-flex items-center gap-1">
      {value}{unit} <span className={color}>{icon}</span>
    </span>
  );
}

function SensorCard({ label, data }: { label: string; data: SensorData }) {
  if (!data.available) {
    return (
      <div className="flex-1 p-3 bg-black/20 rounded-lg">
        <div className="text-sm text-gray-400 mb-1">{label}</div>
        <div className="text-gray-500 text-sm">{data.error || 'No data'}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 bg-black/20 rounded-lg">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-300">Temp</span>
          <Trend trend={data.temperature_trend} value={data.temperature} unit="°" />
        </div>
        <div className="flex justify-between">
          <span className="text-gray-300">Humidity</span>
          <Trend trend={data.humidity_trend} value={data.humidity} unit="%" />
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Feels</span>
          <span>{data.feels_like}°</span>
        </div>
        {data.battery < 20 && (
          <div className="text-yellow-400 text-xs">⚠ Battery {data.battery}%</div>
        )}
      </div>
    </div>
  );
}

export default function Climate({ panel }: { panel: Panel }) {
  const relayUrl = useConfigStore((s) => s.relayUrl);
  const updatePanel = useConfigStore((s) => s.updatePanel);

  // Season mode: true = cooling (summer), false = heating (winter)
  const wantCooler = panel.args?.wantCooler ?? true;

  const toggleMode = () => {
    updatePanel(panel.id, {
      ...panel,
      args: { ...panel.args, wantCooler: !wantCooler },
    });
  };

  const { data, isLoading, error } = useWidgetQuery<ClimateData>(
    ['climate', relayUrl],
    async () => {
      const res = await fetch(`${relayUrl}/sensors/all`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    { refetchInterval: 60_000, enabled: !!relayUrl }
  );

  if (!relayUrl) return <div className="p-4 text-gray-500">Configure relay URL</div>;
  if (isLoading) return <div className="p-4 text-gray-500">Loading...</div>;
  if (error) return <div className="p-4 text-red-400">Error loading sensors</div>;
  if (!data) return null;

  const { indoor, outdoor, comparison } = data;

  // Determine recommendation based on mode
  const getRecommendation = () => {
    if (!comparison) return null;

    const { outside_feels_cooler, outside_feels_warmer, difference } = comparison;
    const absDiff = Math.abs(difference);

    if (!outside_feels_cooler && !outside_feels_warmer) {
      return { action: 'similar', text: 'Indoor and outdoor feel similar', icon: '≈' };
    }

    if (wantCooler) {
      // Cooling mode (summer) - want outside to be cooler
      if (outside_feels_cooler) {
        return { action: 'open', text: `Open windows - outside ${absDiff}° cooler`, icon: '🪟' };
      } else {
        return { action: 'close', text: `Keep closed - outside ${absDiff}° warmer`, icon: '🏠' };
      }
    } else {
      // Heating mode (winter) - want outside to be warmer
      if (outside_feels_warmer) {
        return { action: 'open', text: `Open windows - outside ${absDiff}° warmer`, icon: '🪟' };
      } else {
        return { action: 'close', text: `Keep closed - outside ${absDiff}° cooler`, icon: '🏠' };
      }
    }
  };

  const recommendation = getRecommendation();

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header with mode toggle */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-lg font-medium">Climate</div>
        <button
          onClick={toggleMode}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            wantCooler
              ? 'bg-orange-900/40 text-orange-200 hover:bg-orange-900/60'
              : 'bg-blue-900/40 text-blue-200 hover:bg-blue-900/60'
          }`}
        >
          {wantCooler ? '☀️ Cooling' : '❄️ Heating'}
        </button>
      </div>

      {/* Sensor readings */}
      <div className="flex gap-3 mb-4">
        <SensorCard label="Indoor" data={indoor} />
        <SensorCard label="Outdoor" data={outdoor} />
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className={`p-3 rounded-lg text-center ${
          recommendation.action === 'open' ? 'bg-green-900/30 text-green-200' :
          recommendation.action === 'close' ? 'bg-gray-800/50 text-gray-300' :
          'bg-gray-800/50 text-gray-300'
        }`}>
          <div className="text-2xl mb-1">{recommendation.icon}</div>
          <div className="text-sm">{recommendation.text}</div>
        </div>
      )}
    </div>
  );
}
```

**Update:** `src/components/widgets/index.tsx`

```tsx
export const Climate = lazy(() => import('./Climate'));

// Add to WIDGET_COMPONENTS
climate: Climate,
```

---

### Phase 4: Pairing Sensors

After hardware arrives and setup script runs:

1. **Enable pairing:**
   ```bash
   # Edit /opt/zigbee2mqtt/data/configuration.yaml
   # Set: permit_join: true
   sudo systemctl restart zigbee2mqtt
   ```

2. **Pair each sensor:**
   - Hold button 5+ seconds until LED blinks
   - Check web UI at http://kiosk.local:8080

3. **Name sensors** in config:
   ```yaml
   devices:
     '0x00158d0001234567':
       friendly_name: 'indoor_climate'
     '0x00158d0007654321':
       friendly_name: 'outdoor_climate'
   ```

4. **Disable pairing:**
   ```bash
   # Set: permit_join: false
   sudo systemctl restart zigbee2mqtt
   ```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /sensors/status` | MQTT connection status |
| `GET /sensors/indoor` | Indoor temp, humidity, trends, feels-like |
| `GET /sensors/outdoor` | Outdoor temp, humidity, trends, feels-like |
| `GET /sensors/all` | Both + comparison (which feels cooler) |

### Example: `/sensors/all`

```json
{
  "indoor": {
    "available": true,
    "temperature": 23.5,
    "humidity": 45,
    "feels_like": 23.2,
    "temperature_trend": "rising",
    "humidity_trend": "steady",
    "battery": 87
  },
  "outdoor": {
    "available": true,
    "temperature": 18.2,
    "humidity": 65,
    "feels_like": 17.8,
    "temperature_trend": "falling",
    "humidity_trend": "rising",
    "battery": 92
  },
  "comparison": {
    "outside_feels_cooler": true,
    "outside_feels_warmer": false,
    "difference": -5.4
  }
}
```

---

## Testing

```bash
# Test MQTT is receiving sensor data
mosquitto_sub -t 'zigbee2mqtt/#' -v

# Test API endpoints
curl http://localhost:5111/sensors/status
curl http://localhost:5111/sensors/all
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Dongle not detected | `ls /dev/ttyUSB* /dev/ttyACM*` - update config if different |
| Sensor won't pair | Hold button longer (5-10s), check `permit_join: true` |
| No MQTT data | `systemctl status mosquitto zigbee2mqtt` |
| Outdoor sensor drops | Add Zigbee repeater (smart plug) near window |
| Stale readings | Check `age_seconds` in API response, sensor may need new battery |

---

## Mini Climate Widget (for calendar header)

Compact 2-row version for the calendar header whitespace:

```
┌───────────────────────────────────────┐
│ 🏠 72°↑ 45%→   🌳 65°↓ 60%↑   [⚙️]  │
│        ❄️ Outside 7° cooler           │
└───────────────────────────────────────┘
```

Or when warmer outside:
```
┌───────────────────────────────────────┐
│ 🏠 72°↑ 45%→   🌳 85°↑ 70%↑   [⚙️]  │
│        🔥 Outside 13° warmer          │
└───────────────────────────────────────┘
```

**Settings button [⚙️]:** Tap to toggle mode (☀️ Cooling ↔ ❄️ Heating) or open mini settings popover

**Shows:**
- Indoor temp + trend, humidity + trend
- Outdoor temp + trend, humidity + trend
- Which feels cooler/warmer and by how much

**Widget variants:**
- `climate` - full panel version with all details + mode toggle
- `climate-mini` - compact 2-row for calendar header

---

## Future Enhancement: Calendar Header Expansion

The climate widget (and other mini widgets) live in the calendar's top whitespace. Add a calendar setting to expand that header area if more space needed:

**Setting:** `headerHeight` or `headerRows` in calendar widget args

```
┌─────────────────────────────────────────────────────┐
│ [Time] [Kasa] [WoL] [Brightness] [Climate-mini]     │  ← headerRows: 2
│ [Settings]  [other mini widget]                     │     (expanded)
│─────────────────────────────────────────────────────│
│          Sun  Mon  Tue  Wed  Thu  Fri  Sat          │  ← calendar days
│           ...                                       │     pushed down
└─────────────────────────────────────────────────────┘
```

This allows more mini widgets without taking a full panel slot.
