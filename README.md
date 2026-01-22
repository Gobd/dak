# DAK Apps

## Live Apps

| App             | URL                                     | Stack                   |
| --------------- | --------------------------------------- | ----------------------- |
| Dashboard       | https://dak.bkemper.me/dashboard/       | Vite + React + Tailwind |
| Family Chores   | https://dak.bkemper.me/family-chores/   | Vite + React + Tailwind |
| Health Tracker  | https://dak.bkemper.me/health-tracker/  | Vite + React + Tailwind |
| Kasa Controller | https://dak.bkemper.me/kasa-controller/ | Vite + React + Tailwind |
| Notes App       | https://dak.bkemper.me/notes-app/       | Expo + React Native Web |

All apps use TypeScript, Zustand for state, and Supabase for backend.

## Development

```bash
# Family Chores / Health Tracker
cd <app> && pnpm install && pnpm dev

# Notes App (runs editor build + expo concurrently)
cd notes-app && pnpm install && pnpm start

# Dashboard
cd dashboard && pnpm dev
```

## Quality Checks

Each app has the same commands:

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm format:check  # Prettier
pnpm format        # Auto-fix formatting
pnpm analyze       # Bundle size analysis
```

## Deployment

Push to `main` to automatically deploy all apps to Cloudflare Pages.

Hosted at `dak.bkemper.me` with preview deployments for PRs.
