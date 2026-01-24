# DAK Apps

Browse all apps at [dak.bkemper.me](https://dak.bkemper.me).

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
