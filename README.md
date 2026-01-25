# DAK Apps

A suite of smart home apps for wall-mounted displays, built for Raspberry Pi.

Browse all apps at [dak.bkemper.me](https://dak.bkemper.me).

## Quick Start

### Hardware

- Raspberry Pi 4 (or newer)
- Touchscreen display
- USB microphone (optional, for voice control)

### Flash & Setup

1. Flash **Raspberry Pi OS Lite (64-bit)** to SD card
2. Enable SSH, set hostname, connect to Wi-Fi via Raspberry Pi Imager
3. From your laptop, run the deploy script:

```bash
./dashboard/scripts/deploy.sh <user@host>
```

This SSHs into the Pi and sets up everything:

- **Kiosk** - Cage (Wayland compositor), Chromium, auto-login
- **Home relay** - Python service for Kasa, WoL, brightness, config sync
- **Zigbee** - Mosquitto MQTT broker, Zigbee2MQTT
- **Voice** - Audio packages for Vosk/Piper voice control
- **Extras** - i2c for DDC brightness, virtual keyboard, auto-brightness cron

## Apps

| App                                           | Description                                                       |
| --------------------------------------------- | ----------------------------------------------------------------- |
| [Dashboard](readmes/dashboard.md)             | Kiosk dashboard with customizable widgets and smart home controls |
| [Notes App](readmes/notes-app.md)             | Rich-text note-taking with sharing and real-time sync             |
| [Health Tracker](readmes/health-tracker.md)   | Family medication and shot tracking                               |
| [Family Chores](readmes/family-chores.md)     | Chore management with points and leaderboards                     |
| [Climate Display](readmes/climate-display.md) | Indoor/outdoor temperature display                                |
| [Kasa Controller](readmes/kasa-controller.md) | Smart plug control app                                            |

## Packages

| Package                                                | Description                         |
| ------------------------------------------------------ | ----------------------------------- |
| [@dak/ui](readmes/ui.md)                               | Shared UI components                |
| [@dak/hooks](readmes/hooks.md)                         | Shared React hooks                  |
| [@dak/vite-shared-react](readmes/vite-shared-react.md) | Shared Vite config and theme        |
| [@dak/api-client](readmes/api-client.md)               | Generated home-relay API client     |
| [@dak/kasa-client](readmes/kasa-client.md)             | Kasa smart plug hooks and utilities |

## Stack

- **Runtime** - React 19, TypeScript 5.9
- **Build** - Vite 8, pnpm workspaces
- **Styling** - Tailwind CSS 4
- **State** - Zustand
- **Linting** - oxlint
- **Formatting** - oxfmt
- **Backend** - Supabase (auth/db), FastAPI (home-relay)
- **Hosting** - Cloudflare Pages

## Development

```bash
# From repo root - runs all apps
pnpm dev

# Or run a single app
cd <app> && pnpm dev
```

## Quality Checks

```bash
pnpm lint          # oxlint
pnpm typecheck     # TypeScript (all apps)
pnpm format:check  # oxfmt
pnpm format        # Auto-fix formatting
pnpm check         # Run all checks + build

./scripts/ci.sh    # Run all CI checks locally with auto-fix
```

## Deployment

Push to `main` to automatically deploy all apps to Cloudflare Pages.

Hosted at `dak.bkemper.me` with preview deployments for PRs.

## Notes

- All apps support light and dark mode (system preference or manual toggle)
- Instead of using the hosted version, you can run `pnpm dev` on the Pi and point Chromium to `localhost:8080`

## Credits

Built with [Claude Code](https://claude.ai/code) (Anthropic's AI assistant) handling most of the implementation, with human direction on architecture, features, and design decisions.
