# Dashboard Configuration

This directory contains the default dashboard configuration template.

## File Locations

- **In repo:** `config/dashboard.json` - Default template (version controlled)
- **On kiosk:** `~/.config/home-relay/dashboard.json` - User's customized config

## Configuration Structure

### global

Global dashboard settings:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `background` | string | `"#111"` | Dashboard background color |
| `dark` | boolean | `true` | Enable dark mode for widgets |
| `navPosition` | string | `"bottom-right"` | Nav button position: `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| `navButtons` | string | `"both"` | Which nav buttons to show: `both`, `next`, `prev`, `none` |
| `navColor` | string | `"rgba(255,255,255,0.6)"` | Nav button text/arrow color |
| `navBackground` | string | `"rgba(255,255,255,0.1)"` | Nav button background color |

### screens

Array of screen objects. Each screen contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the screen |
| `panels` | array | Array of panel objects |

### Panel Options

Each panel supports:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Widget type (see below) |
| `src` | string | URL for iframe panels |
| `args` | object | Widget-specific options |
| `x`, `y` | string | Position as percentage (e.g., `"0%"`, `"50%"`) |
| `w`, `h` | string | Size as percentage (e.g., `"100%"`, `"50%"`) |
| `refresh` | string | Auto-refresh interval: `30s`, `1m`, `5m`, `30m`, `1h` |
| `css` | string | Additional CSS to apply |

### Widget Types

| Type | Description | Args |
|------|-------------|------|
| `calendar` | Google Calendar | `showTime: boolean` |
| `weather` | NWS Weather forecast | `layout: "horizontal"\|"vertical"` |
| `uv` | UV Index chart | `safeThreshold: number` |
| `aqi` | Air Quality Index chart | - |
| `sun-moon` | Sunrise/sunset, moon phase | - |
| `drive-time` | Commute time overlay | `dark: boolean` |
| `kasa` | Kasa smart device toggles | - |
| `wol` | Wake on LAN | - |
| `brightness` | Auto-brightness settings | - |
| `iframe` | Embedded URL | - |

### brightness

Auto-brightness control settings:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable auto-brightness |
| `lat` | number | `null` | Latitude for sunrise/sunset calculation |
| `lon` | number | `null` | Longitude for sunrise/sunset calculation |
| `location` | string | `null` | Display name for location |
| `dayBrightness` | number | `100` | Brightness level during day (1-100) |
| `nightBrightness` | number | `1` | Brightness level at night (1-100) |
| `transitionMins` | number | `60` | Transition duration in minutes |

### locations

Location settings for weather widgets:

```json
{
  "weather": {
    "lat": "37.7749",
    "lon": "-122.4194",
    "city": "San Francisco",
    "state": "CA"
  }
}
```

### wolDevices

Array of Wake-on-LAN devices:

```json
[
  {
    "name": "Office PC",
    "ip": "192.168.1.100",
    "mac": "AA:BB:CC:DD:EE:FF"
  }
]
```

### driveTime

Drive time configuration:

```json
{
  "locations": {
    "home": "123 Main St, San Francisco, CA",
    "work": "456 Office Blvd, San Francisco, CA"
  },
  "routes": [
    {
      "origin": "home",
      "destination": "work",
      "via": [[37.7849, -122.4094]],
      "viaLabel": "Via Market St",
      "days": ["mon", "tue", "wed", "thu", "fri"],
      "startTime": "7:00",
      "endTime": "9:00",
      "label": "Morning Commute",
      "minTimeToShow": 15
    }
  ]
}
```

## Editing Configuration

### Via Dashboard UI

1. Visit the dashboard with `?edit` in the URL
2. Configure widgets via their settings buttons
3. Changes are saved automatically

### Via SSH

Edit the config file directly:

```bash
ssh kiosk@kiosk.local
nano ~/.config/home-relay/dashboard.json
```

Refresh the dashboard to see changes.

## Fallback Behavior

The dashboard loads configuration in this order:

1. **API** (`GET /config`) - Primary source from `~/.config/home-relay/dashboard.json`
2. **localStorage** - Browser backup (updated on save)
3. **Default template** - Fetch `config/dashboard.json` from repo

This ensures the dashboard works even if the home-relay service is down.

## Developer Notes

### Default Configuration

`config/dashboard.json` is the single source of truth for default configuration.

- **Browser**: Fetches `/config/dashboard.json` from GitHub Pages
- **Server**: Reads `~/dashboard/config/dashboard.json` (deployed by setup script)

**When adding new config fields:** Just update `config/dashboard.json`.
