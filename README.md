# DAK Apps

## Live Apps

| App | URL | Stack |
|-----|-----|-------|
| Family Chores | https://gobd.github.io/dak/family-chores/ | Vite + React + Tailwind |
| Health Tracker | https://gobd.github.io/dak/health-tracker/ | Vite + React + Tailwind |
| Notes App | https://gobd.github.io/dak/notes-app/ | Expo + React Native Web |

All apps use TypeScript, Zustand for state, and Supabase for backend.

## Development

```bash
# Family Chores / Health Tracker
cd <app> && pnpm install && pnpm dev

# Notes App (runs editor build + expo concurrently)
cd notes-app && pnpm install && pnpm start
```

## Quality Checks

Each app has the same commands:

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm format:check  # Prettier
pnpm format        # Auto-fix formatting
```

## Deployment

Push to `main` to automatically deploy all apps to GitHub Pages.

Manual deploy: Actions tab → "Deploy to GitHub Pages" → "Run workflow" → enter branch name.
