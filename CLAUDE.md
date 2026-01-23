# DAK Monorepo - Claude Code Instructions

## Monorepo Structure

```
apps/
  dashboard/        # Home dashboard with widgets
  notes-app/        # Note-taking app
  health-tracker/   # Medication tracking
  family-chores/    # Chore management
  climate-display/  # Climate sensors display
  kasa-controller/  # Smart plug control

packages/
  ui/               # Shared UI components (@dak/ui)
  vite-shared-react/ # Shared Vite config & theme
  api-client/       # Generated home-relay API client (@dak/api-client)
  kasa-client/      # Kasa smart plug client
```

## Code Quality

Run the full CI script before completing work:

```bash
./scripts/ci.sh   # Runs all checks with auto-fix
```

This runs: lint, format, knip (unused code), Python checks (ruff/pyright), API client gen, typecheck, and build.

For quick checks during development:

```bash
pnpm lint        # oxlint - must be 0 warnings, 0 errors
pnpm typecheck   # TypeScript
pnpm build       # Verify all apps build
```

## Theme System

All colors come from `/packages/vite-shared-react/theme/theme.css`. Never use hardcoded Tailwind colors like `text-gray-500` or `bg-zinc-800`.

**Semantic tokens:**

- `bg-surface`, `bg-surface-raised`, `bg-surface-sunken` - backgrounds
- `text-text`, `text-text-secondary`, `text-text-muted` - text
- `border-border` - borders
- `bg-accent`, `text-accent` - primary actions (blue)
- `bg-success`, `bg-warning`, `bg-danger` - status colors

**Dark mode:** Handled automatically by tokens. No need for `dark:` variants on semantic colors.

## Shared Packages

### @dak/ui

Shared components: `Button`, `Modal`, `Input`, `DatePicker`, `TimePicker`, etc.

```tsx
import { Button, Modal } from '@dak/ui';
```

### vite-shared-react

- `createViteConfig()` - Base Vite config for all apps
- `theme.css` - Import in app's index.css
- `fonts.css` - Shared fonts

```tsx
// vite.config.ts
import { createViteConfig } from '@dak/vite-shared-react';
export default createViteConfig({ port: 3001 });

// index.css
@import '@dak/vite-shared-react/theme.css';
```

### @dak/api-client

Generated TypeScript client for the home-relay Python API (dashboard backend). Auto-generated from OpenAPI spec via `pnpm gen:api`.

### Supabase

Notes-app, family-chores, and health-tracker use Supabase directly for auth and data. Dashboard uses home-relay instead.

## Dashboard

### Config Store

Dashboard layout is stored in `stores/config-store.ts`. Default config defines:

- `screens` - Array of screen layouts
- `panels` - Widget instances with position, size, and args
- `globalSettings` - App-wide settings (location, voice, etc.)

### Widgets

Widgets live in `dashboard/src/components/widgets/`. Each widget:

- Exports default function component
- Receives `WidgetComponentProps` (panel config, optional dark/isEditMode)
- Is lazy-loaded via `index.tsx`

**Available widgets:** weather, calendar, drive-time, sun-moon, aqi, uv, kasa, wol, brightness, iframe, climate, timer, ptt, mqtt, adguard

### Frameless Widgets

Some widgets render without a background/frame (just an icon button). These are defined in `Screen.tsx`:

```tsx
const framelessWidgets = ['timer', 'ptt', 'wol', 'kasa', 'brightness', 'mqtt', 'adguard'];
```

Frameless widgets should be small icon-button style and typically open a modal for interaction. When adding a new widget, decide if it should be frameless (icon-button) or framed (card with content).

To add a widget:

1. Create `WidgetName.tsx` in widgets/
2. Add to `widgetComponents` map in `widgets/index.tsx`
3. Add type to `WidgetType` in `types.ts`
4. Add to `WIDGET_OPTIONS` in `components/layout/EditToolbar.tsx` (for the add widget dropdown)

### Related Standalone Apps

Some widgets have matching standalone apps for dedicated displays:

| Widget    | Standalone App     | Purpose                        |
| --------- | ------------------ | ------------------------------ |
| `climate` | `climate-display/` | Indoor/outdoor temp comparison |
| `kasa`    | `kasa-controller/` | Smart plug control             |

The standalone apps share the same backend (home-relay) but have their own UI optimized for dedicated tablets/displays.

## Patterns

- **No underscore prefix** for unused params - remove them or fix the code
- **Optional props** in interfaces for props that aren't always needed
- **Semantic tokens only** - no hardcoded colors
- **Remove unused imports** - lint enforces this
