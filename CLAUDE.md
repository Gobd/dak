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
  hooks/            # Shared React hooks (@dak/hooks)
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
pnpm -w lint     # oxlint from workspace root - must be 0 warnings, 0 errors
pnpm typecheck   # TypeScript (run from app directory)
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

Shared components for forms, layout, and feedback:

- **Buttons & inputs:** `Button`, `Input`, `Toggle`, `SearchInput`, `Slider`
- **Layout:** `Card`, `Chip`
- **Modals:** `Modal`, `ConfirmModal`
- **Pickers:** `DatePicker`, `DatePickerCompact`, `TimePickerCompact`, `DateTimePicker`, `NumberPickerCompact`
- **Feedback:** `Spinner`, `Badge`, `EmptyState`, `ProgressRing`, `Alert`
- **Auth:** `Login`, `SignUp`, `ForgotPassword`, `ResetPassword`, `ProtectedRoute`, `createAuthStore`
- **Utilities:** `Avatar`, `PasswordRequirements`, `Roller`, `RealtimeSync`, `createThemeStore`, `createSupabaseClient`, `isPasswordValid`

```tsx
import { Button, Modal, Spinner, Toggle, ProtectedRoute } from '@dak/ui';
```

**Storybook:** All UI components should have a `.stories.tsx` file. Run `pnpm storybook` from `packages/ui` to view. When adding new components, create a story file alongside the component.

#### Auth Store

Use `createAuthStore` to create an auth store for Supabase apps:

```tsx
// stores/auth-store.ts
import { createAuthStore } from '@dak/ui';
import { supabase } from '../lib/supabase';

export const useAuthStore = createAuthStore({
  supabase,
  onSignOut: () => unsubscribeFromSync(), // Optional cleanup
  basePath: '/my-app', // Optional: for redirect URLs
});
```

The store provides:

- `session`, `user`, `loading`, `isLoading`, `isInitialized`
- `initialize()` - Call on app mount
- `signIn(email, password)` - Returns `{ error }`
- `signUp(email, password)` - Standard registration
- `register(email)` - Email-first registration (password set after verification)
- `setPassword(password)` - Set password after email verification
- `resetPassword(email)` - Send password reset email
- `updatePassword(password)` - Update password (when logged in)
- `signOut()`

#### Protected Routes

Use `ProtectedRoute` for auth-protected pages:

```tsx
import { ProtectedRoute } from '@dak/ui';

function App() {
  const { session, loading } = useAuthStore();

  return (
    <ProtectedRoute session={session} loading={loading}>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

#### Supabase Client

Use `createSupabaseClient` for consistent Supabase initialization:

```tsx
// lib/supabase.ts
import { createSupabaseClient } from '@dak/ui';

// Basic usage
export const supabase = createSupabaseClient();

// With PKCE auth flow (recommended for public clients)
export const supabase = createSupabaseClient({ pkce: true });
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables.

### @dak/hooks

Shared React hooks for common patterns:

- `useLocalStorage` - Persist state to localStorage
- `useInterval` - setInterval with cleanup
- `useMediaQuery` - Responsive breakpoint detection
- `useKeyPress` - Keyboard event handling
- `useToggle` - Boolean state with toggle/on/off
- `useCopyToClipboard` - Clipboard API wrapper
- `useDarkMode` - Dark mode state and detection

```tsx
import { useLocalStorage, useToggle, useDarkMode } from '@dak/hooks';
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

### Supabase Apps

Notes-app, family-chores, and health-tracker use Supabase for auth and data. All three use the shared `createSupabaseClient` and `createAuthStore` factories from `@dak/ui`.

Dashboard uses home-relay backend instead of Supabase.

## Dashboard

### Config Store

Dashboard layout is stored in `stores/config-store.ts`. Default config defines:

- `screens` - Array of screen layouts
- `panels` - Widget instances with position, size, and args
- `globalSettings` - App-wide settings (location, voice, etc.)

### Panel Positioning

Panels support two positioning modes:

**Percentage mode** (default) - `x`, `y`, `width`, `height` are percentages (0-100) of the viewport. Use for background widgets that should fill/scale with the screen (calendars, iframes, full-width content).

```json
{ "widget": "calendar", "x": 30, "y": 0, "width": 70, "height": 100 }
```

**Anchored/pixel mode** - for floating widgets that need fixed sizing across different resolutions. Prevents small widgets from growing/shrinking weirdly on different screens.

```json
{
  "widget": "climate",
  "x": 0,
  "y": 0,
  "width": 10,
  "height": 10,
  "anchor": "top-right",
  "offsetX": 184,
  "offsetY": 16,
  "widthPx": 130,
  "heightPx": 104
}
```

When `anchor` is set with `widthPx`/`heightPx`, pixel positioning takes precedence. The percentage values (`x`, `y`, `width`, `height`) are still required for backwards compatibility and edit mode.

**Anchor options:** `top-left`, `top-right`, `bottom-left`, `bottom-right`

Use percentage mode for layout widgets (calendar, notes, weather panels). Use anchored mode for small floating widgets (icon buttons, climate display, status indicators).

### Widgets

Widgets live in `dashboard/src/components/widgets/`. Each widget:

- Exports default function component
- Receives `WidgetComponentProps` (panel config, optional dark/isEditMode)
- Is lazy-loaded via `index.tsx`

**Available widgets:** weather, calendar, clock, drive-time, sun-moon, aqi, uv, kasa, wol, brightness, iframe, climate, timer, ptt, mqtt, adguard

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
- **Update READMEs** - after adding/removing features, check and update:
  - `readmes/*.md` - per-app documentation (linked from main README)
  - `apps/*/README.md` - app-specific docs
  - `apps/*/public/config/README.md` - config documentation (if applicable)
