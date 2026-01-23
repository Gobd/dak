# DAK Apps

Browse all apps at [dak.bkemper.me](https://dak.bkemper.me).

## Live Apps

| App             | URL                                     | Stack                   |
| --------------- | --------------------------------------- | ----------------------- |
| Climate Display | https://dak.bkemper.me/climate-display/ | Vite + React + Tailwind |
| Dashboard       | https://dak.bkemper.me/dashboard/       | Vite + React + Tailwind |
| Family Chores   | https://dak.bkemper.me/family-chores/   | Vite + React + Tailwind |
| Health Tracker  | https://dak.bkemper.me/health-tracker/  | Vite + React + Tailwind |
| Kasa Controller | https://dak.bkemper.me/kasa-controller/ | Vite + React + Tailwind |
| Notes App       | https://dak.bkemper.me/notes-app/       | Vite + React + Tailwind |

All apps use React, TypeScript, and Zustand for state.

## Development

```bash
# From repo root - runs all apps
pnpm dev

# Or run a single app
cd <app> && pnpm dev
```

## Quality Checks

From repo root:

```bash
pnpm lint          # Oxlint
pnpm typecheck     # TypeScript (all apps)
pnpm format:check  # Oxfmt
pnpm format        # Auto-fix formatting
pnpm check         # Run all checks + build

./scripts/ci.sh    # Run all CI checks locally with auto-fix
```

## Deployment

Push to `main` to automatically deploy all apps to Cloudflare Pages.

Hosted at `dak.bkemper.me` with preview deployments for PRs.
