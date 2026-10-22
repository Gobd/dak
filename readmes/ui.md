# @dak/ui

Shared UI component library used by all apps.

## Components

- **Button** - Primary, secondary, danger variants
- **Modal** - Base modal with customizable content
- **ConfirmModal** - Confirmation dialog with cancel/confirm
- **AlertModal** - Alert dialog with single action
- **DatePicker** - Date selection with calendar
- **TimePicker** - Time selection with hour/minute
- **DateTimePicker** - Combined date and time
- **NumberPickerCompact** - Compact number input with increment/decrement
- **Roller** - Wheel picker for mobile-friendly selection

## Auth Components

Pre-built Supabase auth forms:

- **Login** - Email/password login
- **SignUp** - Registration form
- **ForgotPassword** - Password reset request
- **ResetPassword** - New password form

## Store Factories

- **createAuthStore** - Zustand store for Supabase auth state
- **createThemeStore** - Zustand store for theme management

## Utilities

- **RealtimeSync** - Component for Supabase real-time subscriptions

## Usage

```tsx
import { Button, Modal, DatePicker } from '@dak/ui';
```

## Tailwind class discovery

Import the UI package's CSS entry after Tailwind and the shared theme:

```css
@import 'tailwindcss';
@import '@dak/vite-shared-react/theme.css';
@import '@dak/ui/tailwind.css';
```

The UI package declares its own source directory. Apps do not need relative paths into `packages/ui`.

Use `@import '@dak/ui/utilities.css';` for shared utilities such as `scrollbar-hide`.
