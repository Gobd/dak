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
