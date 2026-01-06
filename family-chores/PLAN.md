# Family Chores

A single-page PWA for tracking family chores with points. Works on smart displays, tablets, phones, laptops.

**Location:** `/Users/bkemper/Developer/LIVEauctioneers/simplenotes/family-chores`

---

## Core Concepts

1. **One Supabase login** - shared household account (disable signup after)
2. **PIN for admin stuff** - manage chores, family, redeem points, settings
3. **No PIN for daily use** - view tasks, check them off, see leaderboard
4. **Single page** - dashboard with tabs, everything else is modals
5. **RLS** - all data scoped to authenticated user

---

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4 (neutral for dark mode)
- Zustand (state)
- Supabase (DB + Auth + Realtime)
- PWA (offline, installable)

---

## Database (sql/schema.sql)

```sql
-- Family members
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '👤',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chores
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  points INT NOT NULL DEFAULT 1,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'every_x_days', 'weekly', 'monthly')),
  interval_days INT,          -- every_x_days: interval
  weekly_days INT[],          -- weekly: [0,1,2...] (0=Sun)
  monthly_day INT,            -- monthly: 1-31 or -1 for last
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments (many-to-many)
CREATE TABLE chore_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  UNIQUE(chore_id, member_id)
);

-- Daily instances (generated on-demand)
CREATE TABLE chore_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  points_awarded INT,
  UNIQUE(chore_id, scheduled_date)
);

-- Points ledger
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'adjustment')),
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() UNIQUE,
  parent_pin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Enable on all tables, policy = user_id = auth.uid()
-- (chore_assignments, chore_instances, points_ledger via FK to parent tables)
```

---

## UI Structure

### Single Page Dashboard

```
┌─────────────────────────────────────────────────┐
│  [Today] [My Tasks] [Weekly] [Leaderboard]      │  ← Tab bar
├─────────────────────────────────────────────────┤
│                                                 │
│              Current View Content               │  ← Swappable views
│                                                 │
├─────────────────────────────────────────────────┤
│  ⚙️  👨‍👩‍👧  📋  🎁  📜  🌙                            │  ← Action bar
└─────────────────────────────────────────────────┘
```

### Views (no PIN)

- **Today** - tasks due today, grouped by member, big checkboxes
- **My Tasks** - single member view (tap to switch member)
- **Weekly** - calendar week with tasks
- **Leaderboard** - points by week/month/all-time

### Modals (PIN required)

- **Settings** - change PIN
- **Family** - add/edit/remove members
- **Chores** - add/edit/remove chores, schedules, assignments
- **Redeem** - deduct points (select member, amount, reason)

### Modals (no PIN)

- **History** - completion log (read-only)
- **Member Picker** - who completed this task?

---

## Files

```
src/
  App.tsx              -- Login or Dashboard
  Dashboard.tsx        -- Main single-page app
  Login.tsx            -- Supabase auth

  components/
    TabBar.tsx         -- View switcher
    ActionBar.tsx      -- Bottom icons

    views/
      TodayView.tsx
      MyTasksView.tsx
      WeeklyView.tsx
      LeaderboardView.tsx

    modals/
      PinModal.tsx
      SettingsModal.tsx
      FamilyModal.tsx
      ChoresModal.tsx
      RedeemModal.tsx
      HistoryModal.tsx
      MemberPickerModal.tsx

    shared/
      TaskCard.tsx
      MemberAvatar.tsx
      SchedulePicker.tsx
      ProgressRing.tsx
      ConfirmModal.tsx

  stores/
    auth-store.ts
    theme-store.ts
    members-store.ts
    chores-store.ts
    instances-store.ts
    points-store.ts
    settings-store.ts

  lib/
    supabase.ts
    realtime.ts
    schedule.ts

  types.ts

sql/
  schema.sql           -- Full schema with RLS
```

---

## Key Flows

### Check off task

1. Tap checkbox
2. If multiple assignees → MemberPickerModal
3. Mark complete, award points
4. Sync to other devices

### Redeem points (PIN)

1. Tap 🎁 → PinModal
2. Select member, enter amount, reason
3. Deduct points (negative ledger entry)

### Daily reset

- On load: generate today's instances based on schedules
- `every_x_days`: check last completion date

---

## Build Order

1. **Setup** - Vite, Tailwind, Supabase, schema
2. **Auth** - Login, auth-store
3. **Dashboard shell** - TabBar, ActionBar, view switching
4. **Family** - members-store, FamilyModal, MemberAvatar
5. **Chores** - chores-store, ChoresModal, SchedulePicker
6. **Today view** - instances-store, TodayView, TaskCard, checking off
7. **Points** - points-store, LeaderboardView, RedeemModal
8. **Other views** - MyTasksView, WeeklyView, HistoryModal
9. **Polish** - PIN protection, dark mode, PWA, realtime sync

---

## Responsive Design

### Smart Display (DAKboard/Skylight)

- Landscape, 1280x800 typical
- Touch-first, big tap targets (min 48px, prefer 64px)
- Tasks in columns per family member (side-by-side)
- Large fonts, high contrast
- Auto-refresh every 30s
- Wake lock (screen stays on)

### Phone (narrow portrait)

- Single column layout
- Swipeable tabs or bottom tab bar
- Tasks stacked vertically
- Member filter at top (tap avatar to filter)
- Collapsible sections to reduce scroll
- Bottom action bar (thumb reach)

### Tablet / Laptop

- 2-3 column grid depending on width
- Comfortable spacing
- Hover states for mouse users
- Keyboard shortcuts optional

### Breakpoints

```
sm: 640px   -- phone
md: 768px   -- tablet portrait
lg: 1024px  -- tablet landscape / small laptop
xl: 1280px  -- laptop / smart display
```

### Touch Targets

- Checkboxes: 48px minimum, 64px on large screens
- Buttons: 44px height minimum
- Tap areas extend beyond visible element

---

## Dark/Light Mode

Using Tailwind `neutral` palette:

```
                Light               Dark
Background      bg-white            bg-neutral-900
Text            text-neutral-900    text-white
Cards           bg-neutral-50       bg-neutral-800
Borders         border-neutral-200  border-neutral-700
Inputs          bg-white            bg-neutral-700
Muted text      text-neutral-500    text-neutral-400
```

- Toggle in ActionBar (sun/moon icon)
- Persisted in localStorage via theme-store
- Applies `dark` class to `<html>`
- Respects system preference on first load
