# Family Chores

A single-page PWA for tracking family chores with points. Designed for smart displays (DAKboard/Skylight), tablets, phones, and laptops.

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (~2 minutes)

### 2. Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `sql/schema.sql` and run it
3. This creates all tables with Row Level Security policies

### 3. Create Your User

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add user** → **Create new user**
3. Enter your email and password
4. (Optional) Go to **Authentication** → **Providers** → **Email** and disable "Enable Sign Up" to prevent others from creating accounts

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials (found in **Settings** → **API**):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and log in with the user you created.

---

## Testing Checklist

### Auth

- [ ] Login works with valid credentials
- [ ] Login shows error with invalid credentials
- [ ] Logout works and redirects to login
- [ ] Dark/light mode toggle works on login page

### Family Members

- [ ] Open Family modal (should require PIN if set)
- [ ] Add a family member with name, emoji, color
- [ ] Edit a family member
- [ ] Delete a family member (with confirmation)
- [ ] Members appear in all views

### Chores

- [ ] Open Chores modal (PIN protected)
- [ ] Add a daily chore
- [ ] Add an "every X days" chore
- [ ] Add a weekly chore (select multiple days)
- [ ] Add a monthly chore
- [ ] Assign chore to one or more family members
- [ ] Edit a chore
- [ ] Disable/enable a chore
- [ ] Delete a chore

### Today View

- [ ] Tasks appear grouped by family member
- [ ] Progress ring shows correct percentage
- [ ] Tap checkbox completes task (single assignee)
- [ ] Tap checkbox shows member picker (multiple assignees)
- [ ] Completed tasks show checkmark, strikethrough, time
- [ ] Tap completed task uncompletes it
- [ ] Points update after completion

### My Tasks View

- [ ] Tap avatar to switch family member
- [ ] Shows only that member's tasks
- [ ] Shows member's total points
- [ ] Complete/uncomplete works

### Weekly View

- [ ] Week navigation (prev/next) works
- [ ] "Today" button jumps to current week
- [ ] Days show task counts
- [ ] Completed tasks show differently than incomplete

### Leaderboard View

- [ ] Period toggle (Week/Month/All) works
- [ ] Members sorted by points for period
- [ ] Shows total balance and period points
- [ ] Top 3 have special styling

### Points & Redeem

- [ ] Open Redeem modal (PIN protected)
- [ ] Select family member
- [ ] Adjust points amount (+/- buttons, quick amounts)
- [ ] Enter reason/notes
- [ ] Redeem deducts points
- [ ] History shows redemption

### History

- [ ] Open History modal
- [ ] Shows earned and redeemed entries
- [ ] Filter by family member works
- [ ] Shows correct +/- amounts

### Settings

- [ ] Open Settings modal (PIN protected)
- [ ] Set/change PIN works
- [ ] Refresh tasks button works

### PIN System

- [ ] First time opening protected modal prompts to set PIN
- [ ] After PIN is set, must enter it to access protected modals
- [ ] Wrong PIN shows error
- [ ] Correct PIN grants access

### Responsive Design

- [ ] Phone (< 640px): Single column, stacked cards
- [ ] Tablet (768-1024px): 2-column grid
- [ ] Desktop/Smart display (> 1024px): 3-column grid, larger touch targets
- [ ] Tab bar readable on all sizes
- [ ] Action bar icons accessible on all sizes

### Dark/Light Mode

- [ ] Toggle in action bar works
- [ ] Persists after refresh
- [ ] All components render correctly in both modes

### PWA

- [ ] Install prompt appears (desktop Chrome)
- [ ] App installs and runs standalone
- [ ] Works offline (cached assets)

### Realtime Sync

- [ ] Open app in two browsers/tabs
- [ ] Complete task in one, appears in other
- [ ] Add family member in one, appears in other

---

## Remaining Tasks / Known Issues

### Likely Bugs to Find

1. **Schedule logic edge cases** - "every X days" might not calculate correctly from last completion
2. **Weekly view data** - may not show instances that haven't been generated yet
3. **Unassigned tasks** - completion flow might be awkward
4. **PIN timeout** - currently doesn't expire, may want to clear after X minutes
5. **Empty states** - some views may not handle zero data gracefully

### Not Yet Implemented

1. **PWA icons** - need to create `public/icon-192.png` and `public/icon-512.png`
2. **Wake lock** - for smart display mode (prevents screen sleep)
3. **Auto-refresh** - periodic refresh for always-on displays
4. **Keyboard shortcuts** - for laptop users
5. **Offline mutations** - changes made offline don't queue for sync

### Nice to Have

1. **Undo toast** - after completing/uncompleting tasks
2. **Haptic feedback** - on task completion (mobile)
3. **Sound effects** - optional celebration sounds
4. **Streak tracking** - consecutive days completed
5. **Data export** - backup/export functionality

---

## Project Structure

```
src/
├── App.tsx                 # Router, auth check, data fetching
├── Dashboard.tsx           # Main single-page layout, modal management
├── Login.tsx               # Login page
├── types.ts                # TypeScript interfaces
├── components/
│   ├── TabBar.tsx          # View switcher
│   ├── ActionBar.tsx       # Bottom action buttons
│   ├── views/
│   │   ├── TodayView.tsx
│   │   ├── MyTasksView.tsx
│   │   ├── WeeklyView.tsx
│   │   └── LeaderboardView.tsx
│   ├── modals/
│   │   ├── PinModal.tsx
│   │   ├── FamilyModal.tsx
│   │   ├── ChoresModal.tsx
│   │   ├── RedeemModal.tsx
│   │   ├── HistoryModal.tsx
│   │   ├── SettingsModal.tsx
│   │   └── MemberPickerModal.tsx
│   └── shared/
│       ├── MemberAvatar.tsx
│       ├── TaskCard.tsx
│       ├── ProgressRing.tsx
│       ├── SchedulePicker.tsx
│       └── ConfirmModal.tsx
├── stores/
│   ├── auth-store.ts
│   ├── theme-store.ts
│   ├── settings-store.ts
│   ├── members-store.ts
│   ├── chores-store.ts
│   ├── instances-store.ts
│   └── points-store.ts
├── lib/
│   ├── supabase.ts
│   └── realtime.ts
└── hooks/
    └── useRealtimeSync.ts

sql/
└── schema.sql              # Full database schema with RLS
```

---

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm run deploy     # Build + deploy to Cloudflare Pages
```

---

## Tech Stack

- React 19 + TypeScript
- Vite 7 + Tailwind CSS 4
- Zustand (state management)
- Supabase (PostgreSQL + Auth + Realtime)
- PWA (vite-plugin-pwa + Workbox)
