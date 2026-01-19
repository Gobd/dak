# Dashboard Configuration

This directory contains the default dashboard configuration.

## File Locations

- **In repo:** `public/config/dashboard.json` - Default template (version controlled)
- **On kiosk:** `~/.config/home-relay/dashboard.json` - User's customized config

## Configuration Structure

### globalSettings

Global dashboard settings:

| Field             | Type    | Default       | Description                                    |
| ----------------- | ------- | ------------- | ---------------------------------------------- |
| `theme`           | string  | `"dark"`      | Theme mode: `"dark"`, `"light"`, or `"system"` |
| `defaultLocation` | object  | San Francisco | Default location for weather/UV/AQI widgets    |
| `hideCursor`      | boolean | `false`       | Hide cursor for kiosk displays                 |

The `defaultLocation` object contains:

```json
{
  "lat": 37.7749,
  "lon": -122.4194,
  "city": "San Francisco",
  "state": "CA"
}
```

### screens

Array of screen objects. Each screen contains:

| Field    | Type   | Description                      |
| -------- | ------ | -------------------------------- |
| `id`     | string | Unique identifier for the screen |
| `name`   | string | Display name for the screen      |
| `panels` | array  | Array of panel objects           |

### Panel Options

Each panel supports:

| Field     | Type   | Description                                           |
| --------- | ------ | ----------------------------------------------------- |
| `id`      | string | Unique identifier for the panel                       |
| `widget`  | string | Widget type (see below)                               |
| `args`    | object | Widget-specific options                               |
| `x`, `y`  | number | Position as percentage (0-100)                        |
| `width`   | number | Width as percentage (0-100)                           |
| `height`  | number | Height as percentage (0-100)                          |
| `refresh` | string | Auto-refresh interval: `30s`, `1m`, `5m`, `30m`, `1h` |

### Widget Types

| Type         | Description                | Args                               |
| ------------ | -------------------------- | ---------------------------------- |
| `calendar`   | Google Calendar            | `showTime: boolean`                |
| `weather`    | NWS Weather forecast       | `layout: "horizontal"\|"vertical"` |
| `uv`         | UV Index chart             | `safeThreshold: number`            |
| `aqi`        | Air Quality Index chart    | -                                  |
| `sun-moon`   | Sunrise/sunset, moon phase | -                                  |
| `drive-time` | Commute time overlay       | -                                  |
| `kasa`       | Kasa smart device toggles  | -                                  |
| `wol`        | Wake on LAN                | -                                  |
| `brightness` | Auto-brightness settings   | -                                  |
| `iframe`     | Embedded URL               | `src: string`                      |

### brightness

Auto-brightness control settings (stored in config, not per-widget):

| Field             | Type    | Default | Description                              |
| ----------------- | ------- | ------- | ---------------------------------------- |
| `enabled`         | boolean | `false` | Enable auto-brightness                   |
| `lat`             | number  | `null`  | Latitude for sunrise/sunset calculation  |
| `lon`             | number  | `null`  | Longitude for sunrise/sunset calculation |
| `locationName`    | string  | `null`  | Display name for location                |
| `dayBrightness`   | number  | `100`   | Brightness level during day (1-100)      |
| `nightBrightness` | number  | `1`     | Brightness level at night (1-100)        |
| `transitionMins`  | number  | `60`    | Transition duration in minutes           |

### locations

Per-widget location overrides. If not set, widgets use `globalSettings.defaultLocation`:

```json
{
  "panel-weather": {
    "lat": 37.7749,
    "lon": -122.4194,
    "city": "San Francisco",
    "state": "CA"
  }
}
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
2. Click the gear icon to access global settings (theme, default location, cursor)
3. Configure widgets via their settings buttons
4. Changes are saved automatically

### Via SSH

Edit the config file directly:

```bash
ssh kiosk@kiosk.home.arpa
nano ~/.config/home-relay/dashboard.json
```

Refresh the dashboard to see changes.

## Fallback Behavior

The dashboard loads configuration in this order:

1. **API** (`GET /config`) - Primary source from `~/.config/home-relay/dashboard.json`
2. **localStorage** - Browser backup (updated on save)
3. **Default template** - Fetch `public/config/dashboard.json` from repo

This ensures the dashboard works even if the home-relay service is down.

## Developer Notes

### Default Configuration

`dashboard.json` in this directory is the single source of truth for default configuration.

- **Browser**: Fetches `/config/dashboard.json` (served from `public/`)
- **Server**: Reads `~/dashboard/config/dashboard.json` (deployed by setup script)

**When adding new config fields:** Update `dashboard.json` and this README.
