# Dashboard

A kiosk dashboard for Raspberry Pi with drag-and-drop layouts, widgets, and smart home controls.

**Live:** [dak.bkemper.me/dashboard](https://dak.bkemper.me/dashboard)

## Quick Start

### Kiosk Setup (Raspberry Pi 5)

1. Flash **Raspberry Pi OS Lite (64-bit)** with SSH enabled
2. Deploy from your Mac:
   ```bash
   ./scripts/deploy.sh kiosk@kiosk.home.arpa
   ```

The Pi reboots into kiosk mode with the dashboard running.

### Edit Layouts

Add `?edit` to the URL or click the pencil button:

- **Drag** panels to move
- **Drag edges** to resize
- **Double-click** to configure (URL, refresh interval, widget args)
- **Gear icon** for global settings (theme, location, cursor)

Config saves to `~/.config/home-relay/dashboard.json` and syncs via SSE.

## Scripts

All scripts are in `scripts/`. Run from your Mac unless noted.

| Script                                      | Description                                   |
| ------------------------------------------- | --------------------------------------------- |
| `deploy.sh <user@host>`                     | Sync files and run setup on kiosk             |
| `deploy.sh <user@host> --no-setup`          | Sync files only (skip setup)                  |
| `deploy.sh <user@host> --restart`           | Sync and restart home-relay service           |
| `install-keyboard.sh [version] [user@host]` | Install Chrome virtual keyboard extension     |
| `clear-cache.sh`                            | Clear browser cache and config (run on kiosk) |

### Virtual Keyboard

For touchscreen kiosks without a physical keyboard:

```bash
# Install latest release to kiosk
./scripts/install-keyboard.sh v3.0.5 kiosk@kiosk.home.arpa

# Install nightly build from branch
./scripts/install-keyboard.sh main kiosk@kiosk.home.arpa

# Install locally (for testing)
./scripts/install-keyboard.sh
```

After installing, enable the extension in Chromium settings.

### Kiosk Helper Scripts

These are installed to `~/scripts/` on the kiosk:

| Script                                          | Description                                     |
| ----------------------------------------------- | ----------------------------------------------- |
| `restart-kiosk.sh`                              | Restart kiosk after closing                     |
| `config-browser.sh`                             | Open browser in normal mode for extension setup |
| `brightness.sh day\|night\|set N\|status\|auto` | Manual brightness control                       |

## Widgets

| Widget       | Description                                    |
| ------------ | ---------------------------------------------- |
| `calendar`   | Google Calendar (OAuth, auto-refreshes tokens) |
| `weather`    | NWS weather forecast                           |
| `uv`         | UV index chart                                 |
| `aqi`        | Air quality index                              |
| `sun-moon`   | Sunrise/sunset, moon phase                     |
| `drive-time` | Commute time overlay                           |
| `kasa`       | Kasa smart plug toggles                        |
| `wol`        | Wake on LAN                                    |
| `brightness` | Auto-brightness settings                       |
| `iframe`     | Any URL                                        |

Widget-specific settings in `args`. See `public/config/README.md` for details.

## Remote Editing

Edit a kiosk's layout from any device on your network:

```
https://dak.bkemper.me/dashboard/?edit&relay=kiosk.home.arpa:5111
```

The `relay` param tells the dashboard where to save config. Changes save to the kiosk and it auto-reloads via SSE.

You can set a default relay URL in global settings (gear icon). This controls where all home-relay API calls go (config, Kasa, WoL, brightness), so set it to your kiosk's address if you're editing from another device.

## Keyboard Shortcuts

| Shortcut       | Action                        |
| -------------- | ----------------------------- |
| `Ctrl+Shift+H` | Toggle cursor visibility      |
| `Ctrl+Alt+F2`  | Switch to terminal (on kiosk) |
| `Ctrl+Alt+F1`  | Back to kiosk                 |
| `Alt+F4`       | Close Chromium                |

## Configuration

Config is stored at `~/.config/home-relay/dashboard.json` on the kiosk, with localStorage as fallback.

### Export / Import

In edit mode, use the toolbar buttons to:

- **Export:** Download current config as JSON file
- **Import:** Upload a JSON config file to replace current config

This is useful for backing up layouts or copying config between devices.

### Other Options

- **Reset:** Click rotate icon to restore defaults
- **SSH edit:** `nano ~/.config/home-relay/dashboard.json`

See `public/config/README.md` for field documentation.

## Development

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

Edit `public/config/dashboard.json` for default layouts.

## Deployment (Cloudflare Pages)

Pushes to `main` deploy automatically. Connect your repo in Cloudflare dashboard → Pages → Create project → Connect to Git.

### Environment Variables

Set these in Cloudflare dashboard → Pages → your project → Settings → Environment variables:

| Variable               | Required For                | How to Get                                                                                   |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Calendar widget             | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Calendar widget             | Same OAuth client as above                                                                   |
| `GOOGLE_MAPS_API_KEY`  | Drive time, location search | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → API Key          |

### Google Cloud Setup

**For Calendar (OAuth):**

1. Create OAuth 2.0 Web Application client
2. Add authorized redirect URIs:
   - `https://yourdomain.com/dashboard/`
   - `http://localhost:8080/` (for dev)
3. Enable Google Calendar API

**For Maps:**

1. Create API key
2. Enable these APIs: Directions, Places, Distance Matrix
3. Restrict key to your domain (optional but recommended)

## Self-Hosting

### Frontend (Cloudflare Pages)

1. Fork this repo
2. Edit `.env` and set `VITE_APP_URL` to your domain
3. In Cloudflare dashboard → Pages → Create project → Connect to Git
4. Set API environment variables (see above)
5. Update `ALLOWED_ORIGINS` in `functions/api/` files to include your domain

The dashboard works without API keys—you just won't have calendar or drive-time widgets.

### Kiosk

1. Edit `scripts/kiosk.conf` and set `DASHBOARD_URL` to your domain
2. Run `deploy.sh` as usual—setup will copy the config automatically

## Troubleshooting

### After Reimaging

If you get a host key error after reimaging the Pi:

```bash
ssh-keygen -R kiosk.home.arpa
```

### Logs & Status

```bash
# Home-relay logs
journalctl -u home-relay -f

# Service status
sudo systemctl status home-relay

# Brightness cron
grep CRON /var/log/syslog | tail -20

# View config
cat ~/.config/home-relay/dashboard.json | jq .
```

## Security

Home-relay has **no authentication**. It's designed for trusted home networks only. Do not expose port 5111 to the internet.
