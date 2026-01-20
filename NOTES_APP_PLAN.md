# Notes App - Implementation Plan

## Overview

Cross-platform note-taking app (iOS, Android, Web) with sync, sharing, tags, and search. Similar to Simplenote but with family/team sharing and offline support.

### Product Philosophy

**Simple and cheap to host.** This is not Google Docs or Notion.

- We're building for users who want a fast, reliable notes app - not a collaboration suite
- No realtime collaboration (Google Docs-style) - if users need that, they should use another tool
- Polling-based sync is fine for 99% of use cases
- Keep infrastructure costs minimal so pricing can stay low
- Features that dramatically increase hosting costs are out of scope

---

## Tech Stack

```
Frontend:     Expo SDK 50+ with Expo Router
Platforms:    iOS, Android, Web (all from day 1)
Styling:      NativeWind (Tailwind for React Native)
State:        Zustand
Backend:      Supabase (PostgreSQL + Auth + Edge Functions)
Sync (Web):   Supabase Realtime (minimal - ping channel only)
Sync (Mobile): Firebase Cloud Messaging (silent push)
Auth:         Email-first registration (verify email, then set password)
Payments:     Stripe (subscriptions)
Offline:      WatermelonDB (SQLite local, syncs to Supabase)
Email:        Supabase built-in
Analytics:    PostHog
Errors:       Highlight.io
Deploy:       Vercel (web), App Store, Play Store
Editor:       Plain text / Markdown
```

### Authentication: Email-First Registration

Email must be verified before setting password.

**Registration flow:**

1. Enter email → click "Register"
2. We send verification email
3. User clicks link in email
4. Taken to "Set Password" screen
5. Set password → account created, logged in

**Login flow:**

1. Enter email + password
2. Logged in

**Forgot password:**

1. Enter email
2. We send reset link
3. Click link → set new password

Benefits:

- Email verified before account exists
- No unverified accounts in database
- Prevents spam signups

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │   iOS   │  │ Android │  │   Web   │                 │
│  └────┬────┘  └────┬────┘  └────┬────┘                 │
│       └───────────┬┴───────────┘                        │
│              ┌────▼────┐                                │
│              │ Zustand │  (State Management)            │
│              └────┬────┘                                │
│              ┌────▼────────┐                            │
│              │ WatermelonDB │  (Local SQLite)           │
│              └────┬────────┘                            │
└───────────────────┼─────────────────────────────────────┘
                    │ Sync (background)
          ┌─────────▼─────────┐
          │     Supabase      │
          │  ┌─────────────┐  │
          │  │ PostgreSQL  │  │  (Database)
          │  │ Auth        │  │  (Authentication)
          │  │ Edge Funcs  │  │  (Webhooks, cron)
          │  └─────────────┘  │
          └───────────────────┘
                    │
          ┌─────────▼─────────┐
          │      Stripe       │  (Subscriptions)
          └───────────────────┘
```

---

## Pricing Structure

### Plans

| Plan           | Monthly    | Annual      | Includes                                       |
| -------------- | ---------- | ----------- | ---------------------------------------------- |
| **Free**       | $0         | $0          | 1 user, 100 notes, online-only, no sharing     |
| **Pro Solo**   | $5/mo      | $50/yr      | 1 user, 5,000 notes, offline, per-note sharing |
| **Pro Family** | $12/mo     | $120/yr     | Up to 6 users, 10,000 shared notes, workspace  |
| **Pro Team**   | $5/user/mo | $50/user/yr | 7+ users, scales with team size                |

### Feature Matrix

| Feature          | Free | Solo  | Family        | Team                |
| ---------------- | ---- | ----- | ------------- | ------------------- |
| Users            | 1    | 1     | Up to 6       | Unlimited           |
| Notes            | 100  | 5,000 | 10,000 shared | 10,000 + 1,000/user |
| Tags             | 20   | 500   | 1,000         | Unlimited           |
| Offline mode     | ❌   | ✅    | ✅            | ✅                  |
| Shared workspace | ❌   | ❌    | ✅            | ✅                  |
| Import/Export    | ❌   | ✅    | ✅            | ✅                  |

### Stripe Implementation

```typescript
const PLANS = {
  free: {
    maxUsers: 1,
    maxNotes: 100,
    offline: false,
    workspace: false,
  },
  solo: {
    monthlyPriceId: 'price_solo_monthly', // $5
    annualPriceId: 'price_solo_annual', // $50
    maxUsers: 1,
    maxNotes: 5000,
    offline: true,
    workspace: false,
  },
  family: {
    monthlyPriceId: 'price_family_monthly', // $12
    annualPriceId: 'price_family_annual', // $120
    maxUsers: 6,
    maxNotes: 10000,
    offline: true,
    workspace: true,
  },
  team: {
    monthlyPricePerUser: 'price_team_monthly', // $5/user
    annualPricePerUser: 'price_team_annual', // $50/user
    maxUsers: Infinity,
    notesPerUser: 1000,
    baseNotes: 10000,
    offline: true,
    workspace: true,
  },
};
```

---

## Database Schema

```sql
-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'free', -- 'free', 'solo', 'family', 'team'
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_period VARCHAR(20), -- 'monthly', 'annual'
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- WORKSPACES (Family/Team sharing)
-- ============================================
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) DEFAULT 'family', -- 'family', 'team'
  note_limit INT DEFAULT 10000,
  deletion_scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- ============================================
-- NOTES
-- ============================================
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(500),
  content TEXT,
  is_private BOOLEAN DEFAULT TRUE,  -- true = only creator sees, false = all workspace members see
  pinned BOOLEAN DEFAULT FALSE,
  trashed_at TIMESTAMP,
  trashed_by UUID REFERENCES users(id),
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
  -- NOTE: No server-side search_vector - all search is client-side via WatermelonDB/LokiJS
);

CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_workspace ON notes(workspace_id);
CREATE INDEX idx_notes_trashed ON notes(trashed_at) WHERE trashed_at IS NOT NULL;
CREATE INDEX idx_notes_updated ON notes(updated_at);

-- ============================================
-- TAGS
-- ============================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT tag_ownership CHECK (
    (user_id IS NOT NULL AND workspace_id IS NULL) OR
    (user_id IS NULL AND workspace_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_tags_unique_user ON tags(user_id, name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_tags_unique_workspace ON tags(workspace_id, name) WHERE workspace_id IS NOT NULL;

CREATE TABLE note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_tag ON note_tags(tag_id);

-- ============================================
-- SYNC TRACKING
-- ============================================
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(20),
  device_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_log_user_time ON sync_log(user_id, timestamp);

-- ============================================
-- DEVICE TOKENS (for push notifications)
-- ============================================
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_token VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
  device_name VARCHAR(100),
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX idx_user_devices_user ON user_devices(user_id);

-- ============================================
-- SEARCH: CLIENT-SIDE ONLY
-- ============================================
-- All search is handled client-side via WatermelonDB (mobile) and LokiJS (web)
-- No server-side search function needed - reduces DB cost and complexity
-- See "Search" section below for client-side implementation details

-- ============================================
-- CRON JOBS
-- ============================================
SELECT cron.schedule('cleanup-trash', '0 3 * * *',
  $$DELETE FROM notes WHERE trashed_at < NOW() - INTERVAL '30 days'$$);

SELECT cron.schedule('cleanup-workspaces', '0 4 * * *',
  $$DELETE FROM workspaces WHERE deletion_scheduled_at < NOW()$$);
```

---

## App Structure

### Sidebar / Navigation

```
├── 📝 All Notes
│
├── 🔒 Private (is_private = true, only yours)
│
├── 👥 Shared (is_private = false, workspace sees)
│
├── #️⃣ Tags
│   ├── #work
│   ├── #personal
│   └── #urgent
│
└── 🗑️ Trash
```

**Organization:** Tags replace folders. Notes can have multiple tags for flexible organization.

**Visibility:** Toggle on each note - 🔒 Private or 👥 Shared. Default is Private.

### Note Limits & Where They Count

| Note Location         | Counts Against               |
| --------------------- | ---------------------------- |
| Personal notes        | Your personal limit          |
| Workspace notes       | Workspace's shared pool      |
| Notes shared WITH you | Owner's limit (free for you) |

---

## Sharing Model

**Simple workspace-based sharing - no per-note permissions.**

### How It Works

- Each note has `is_private` boolean (default: `true`)
- Invite people to your workspace by email
- They see ALL your non-private notes
- Private notes (`is_private = true`) only visible to creator

### No Fine-Grained Sharing

- No per-note sharing UI
- No view/edit permission levels
- No "Shared with me" section
- You're either in the workspace or you're not

### User Flow

1. Create workspace (automatic on paid plan)
2. Invite family/team members by email
3. Mark notes as "Shared" or "Private"
4. All members see all shared notes

### Permissions

| Action                | Creator | Other Members |
| --------------------- | ------- | ------------- |
| View shared note      | ✅      | ✅            |
| Edit shared note      | ✅      | ✅            |
| Toggle private/shared | ✅      | ❌            |
| Delete note           | ✅      | ❌            |

**UI hint:** Show lock icon on notes you can't make private (not your note). Gray out the toggle.

---

## Import / Export

### Export (Solo, Family, Team)

Users can export all their notes for backup or migration away.

**Formats:**
| Format | Contents |
|--------|----------|
| **Markdown ZIP** | One `.md` file per note, folder = tags |
| **JSON** | All notes with metadata (tags, dates, etc.) |

**UI:** Settings → Export → Choose format → Download ZIP

### Import

Users can import from other note apps to migrate here.

**Supported sources:**
| Source | Format | How |
|--------|--------|-----|
| **Simplenote** | JSON export | Settings → Export in Simplenote |
| **Markdown files** | `.md` files | Drag & drop or file picker |
| **Plain text** | `.txt` files | Each file = one note |

**Import flow:**

1. Settings → Import
2. Select source (Simplenote, Markdown, Text)
3. Upload file(s) or ZIP
4. Preview what will be imported
5. Confirm → notes created

**Tag handling on import:**

- Simplenote: tags preserved from JSON
- Markdown: filename becomes title, no tags (user can bulk-tag after)

---

## Trash Behavior

| Note Type       | Trash Location  | Who Can Restore |
| --------------- | --------------- | --------------- |
| Personal note   | Your trash      | Only you        |
| Workspace note  | Workspace trash | Any member      |
| Note you shared | Your trash      | Only you        |

- Auto-delete after 30 days
- Workspace deletion: 7-day grace period with email notification

---

## Offline Sync (WatermelonDB)

### How It Works

```
User Action → WatermelonDB (instant) → Background Sync → Supabase
```

1. All reads/writes go to local SQLite first
2. UI updates instantly
3. Background sync pushes changes to Supabase
4. Pulls remote changes on app launch + periodically
5. Conflict resolution: last-write-wins (version + timestamp)

### WatermelonDB Models

```typescript
// models/Note.ts
import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export class Note extends Model {
  static table = 'notes';
  static associations = {
    tags: { type: 'has_many', foreignKey: 'note_id' },
  };

  @field('title') title!: string;
  @field('content') content!: string;
  @field('workspace_id') workspaceId!: string | null;
  @field('pinned') pinned!: boolean;
  @field('version') version!: number;
  @date('updated_at') updatedAt!: Date;
  @date('trashed_at') trashedAt!: Date | null;

  // Sync tracking
  @field('server_id') serverId!: string | null;
  @field('needs_sync') needsSync!: boolean;
}
```

### Sync Flow

```typescript
async function sync(database: Database) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .gt('updated_at', new Date(lastPulledAt).toISOString());

      return {
        changes: formatForWatermelon(data),
        timestamp: Date.now(),
      };
    },
    pushChanges: async ({ changes }) => {
      for (const note of changes.notes.created) {
        await supabase.from('notes').insert(note);
      }
      for (const note of changes.notes.updated) {
        await supabase.from('notes').update(note).eq('id', note.id);
      }
      for (const id of changes.notes.deleted) {
        await supabase.from('notes').delete().eq('id', id);
      }
    },
  });
}
```

---

## Search (Client-Side Only)

**All search happens on-device** - no server-side search. This reduces Supabase costs and works offline.

### Architecture

| Platform    | Local DB              | Persistence |
| ----------- | --------------------- | ----------- |
| iOS/Android | WatermelonDB (SQLite) | Disk        |
| Web         | LokiJS                | IndexedDB   |

### How It Works

```typescript
// WatermelonDB (mobile) - uses SQLite FTS or LIKE
const results = await database
  .get('notes')
  .query(
    Q.or(Q.where('title', Q.like(`%${query}%`)), Q.where('content', Q.like(`%${query}%`))),
    Q.where('trashed_at', null)
  )
  .fetch();

// LokiJS (web) - in-memory with IndexedDB persistence
const results = notesCollection.find({
  $or: [
    { title: { $regex: new RegExp(query, 'i') } },
    { content: { $regex: new RegExp(query, 'i') } },
  ],
  trashed_at: null,
});
```

### Ranking Priority (client-side)

1. **Exact title match** - highest priority
2. **Title contains** - high priority
3. **Tag match** - medium priority
4. **Content match** - lower priority

### Performance

| Notes  | Response Time | Memory (web) |
| ------ | ------------- | ------------ |
| 100    | <1ms          | ~100KB       |
| 5,000  | <10ms         | ~5MB         |
| 10,000 | <20ms         | ~10MB        |

For <10k notes, client-side search is faster than network round-trip.

### LokiJS Setup (Web)

```typescript
import Loki from 'lokijs';
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter';

const adapter = new LokiIndexedAdapter('simplenotes');
const db = new Loki('simplenotes.db', {
  adapter,
  autoload: true,
  autosave: true,
  autosaveInterval: 4000,
});

// Collections mirror WatermelonDB models
const notes = db.addCollection('notes', { indices: ['title', 'updated_at'] });
const tags = db.addCollection('tags');
const noteTags = db.addCollection('note_tags', { indices: ['note_id', 'tag_id'] });
```

### Why No Server Search?

- **Cost:** No GIN index, no search_vector computation on every write
- **Speed:** Local search is faster than network for <10k notes
- **Offline:** Works without internet
- **Simplicity:** Supabase is just dumb storage + sync

---

## React Native Web

### Expo Commands

```bash
# Development
npx expo start --web

# Build
npx expo export --platform web

# Deploy to Vercel
cd dist && vercel deploy
```

### Responsive Layout

```typescript
function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <View style={{ flexDirection: isDesktop ? 'row' : 'column' }}>
      {isDesktop ? <Sidebar /> : <MobileDrawer />}
      <MainContent />
    </View>
  );
}
```

### Platform-Specific Files

```
Button.tsx        → default (all platforms)
Button.web.tsx    → web only
Button.native.tsx → iOS + Android only
```

---

## File Structure

```
/app
├── (auth)/
│   ├── login.tsx
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (main)/
│   ├── _layout.tsx
│   ├── index.tsx             # Notes list
│   ├── note/[id].tsx         # Note editor
│   ├── tag/[id].tsx          # Tag view (filter by tag)
│   ├── search.tsx
│   ├── shared.tsx            # Shared with me
│   ├── trash.tsx
│   └── settings/
│       ├── index.tsx
│       ├── account.tsx
│       ├── subscription.tsx
│       └── workspace.tsx
/components
├── NoteEditor.tsx
├── NoteList.tsx
├── Sidebar.tsx
├── TagChips.tsx
├── SearchBar.tsx
├── ShareModal.tsx
└── PricingPlans.tsx
/lib
├── supabase.ts
├── database.ts               # WatermelonDB setup
├── sync.ts
├── auth.ts
└── stripe.ts
/models                       # WatermelonDB
├── Note.ts
├── Tag.ts
├── NoteTag.ts
└── schema.ts
/stores                       # Zustand
├── useNotes.ts
├── useTags.ts
├── useAuth.ts
├── useSync.ts
└── useSubscription.ts
```

---

## Implementation Timeline

| Phase              | Duration         | What                       |
| ------------------ | ---------------- | -------------------------- |
| 1. Setup + Auth    | 1 week           | Expo, Supabase, auth flow  |
| 2. Notes CRUD      | 1.5 weeks        | Create, edit, delete, list |
| 3. Tags            | 1 week           | Tag chips, filter by tag   |
| 4. Search          | 1 week           | Full-text with tag support |
| 5. Offline + Sync  | 2 weeks          | WatermelonDB, sync engine  |
| 6. Sharing         | 1.5 weeks        | Per-note + workspaces      |
| 7. Stripe          | 1 week           | Plans, checkout, webhooks  |
| 8. Polish + Deploy | 1.5 weeks        | Testing, app stores        |
| **Total**          | **~10-11 weeks** | Solo, full-time            |

---

## Cost Estimates

### Monthly Infrastructure

| Users   | Supabase | Vercel | Stripe Fees | Total          |
| ------- | -------- | ------ | ----------- | -------------- |
| 100     | $0       | $0     | ~$0         | **~$15/mo**    |
| 10,000  | $75      | $20    | ~$200       | **~$300/mo**   |
| 100,000 | $800     | $150   | ~$2,000     | **~$3,000/mo** |

### Revenue Projection (5% conversion)

| Users   | Paid  | Mix                            | Monthly Rev |
| ------- | ----- | ------------------------------ | ----------- |
| 1,000   | 50    | 30 solo, 15 family, 5 team     | ~$300       |
| 10,000  | 500   | 300 solo, 150 family, 50 team  | ~$3,500     |
| 100,000 | 5,000 | 3k solo, 1.5k family, 500 team | ~$35,000    |

### One-Time Costs

- Apple Developer: $99/year
- Google Play: $25 one-time
- Domain: ~$15/year

---

## Risks & Mitigations

| Risk                    | Impact | Mitigation                                         |
| ----------------------- | ------ | -------------------------------------------------- |
| Sync conflicts          | High   | Last-write-wins first, add conflict UI if needed   |
| WatermelonDB complexity | High   | Start with online-only MVP, add offline in Phase 5 |
| React Native Web gaps   | Medium | Test web early, platform-specific files            |
| Scope creep             | High   | Strict phases, defer nice-to-haves                 |

---

## Portability & Lock-in Analysis

### Easy to Change Later ✅

| Component                  | Why Easy                                           |
| -------------------------- | -------------------------------------------------- |
| Email (SMTP)               | Just swap credentials in Supabase settings         |
| Analytics (PostHog)        | Swap SDK, lose history but no big deal             |
| Error tracking (Highlight) | Same, just swap SDK                                |
| Stripe                     | You're locked in, but why leave? It's the standard |
| Styling (NativeWind)       | Just CSS, can refactor anytime                     |
| State (Zustand)            | Small, easy to swap                                |

### Medium Effort to Change 🟡

| Component       | Migration Path                                                     |
| --------------- | ------------------------------------------------------------------ |
| Database schema | Standard PostgreSQL - can export/import to any Postgres host       |
| WatermelonDB    | Could swap to other local DB, but would need to rewrite sync logic |
| Search          | PostgreSQL FTS is standard SQL, portable                           |

### Hard to Change / Lock-in Risk ⚠️

#### 1. Supabase Auth → Something Else

**Problem:** User passwords are hashed in Supabase. Can't export them.

**Migration:** Users would need to "reset password" to move to new auth system.

**Mitigation:** Supabase Auth is solid, unlikely you'd need to leave. If you did, you'd do a gradual migration (new users on new system, existing users prompted to reset).

#### 2. Supabase Edge Functions → AWS Lambda/Cloudflare

**Problem:** Edge Functions use Deno, slightly different from Node.

**Migration:** Rewrite functions (usually small, not terrible).

**Mitigation:** Keep functions simple, minimal Supabase-specific code.

---

## Sync Strategy (Hybrid: Push + Minimal Realtime)

**MVP Decision:** No polling. Use push notifications (mobile) and lightweight Realtime ping (web).

This keeps costs low while providing responsive sync across all platforms.

### Platform-Specific Sync Triggers

| Platform        | Trigger              | Method                              |
| --------------- | -------------------- | ----------------------------------- |
| **Web**         | Tab open             | Realtime ping channel (lightweight) |
| **Web**         | Tab hidden → visible | Sync on visibility change           |
| **iOS/Android** | App opens            | Sync on launch                      |
| **iOS/Android** | Shared note changed  | Silent push → background sync       |
| **iOS/Android** | App in foreground    | Push notification (no polling)      |
| **All**         | User saves note      | Push immediately to server          |
| **All**         | Pull-to-refresh      | Manual sync                         |

### Web: Lightweight Realtime Ping

One channel per user - only sends "sync now" signal, not actual data:

```typescript
// Web only - single lightweight channel
supabase
  .channel(`user:${userId}:sync`)
  .on('broadcast', { event: 'sync' }, () => {
    // Tiny payload, just triggers sync
    sync();
  })
  .subscribe();

// Also sync when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    sync();
  }
});
```

**Cost:** Scales with concurrent open tabs, not with notes or changes. 10k open tabs = 10k connections (Supabase Pro handles this).

### Mobile: Silent Push Notifications

```typescript
// Server-side: when note is saved, notify other devices
async function onNoteSaved(note: Note, savedByUserId: string) {
  // Get all users who need to know (shared note collaborators, user's other devices)
  const deviceTokens = await getDeviceTokens(note, savedByUserId);

  // Send silent push (no alert, just data)
  await sendPushNotifications(deviceTokens, {
    data: { action: 'sync' },
    contentAvailable: true, // iOS silent push
    priority: 'normal',
  });
}

// Client-side: receive push, sync in background
messaging().onMessage(async (message) => {
  if (message.data?.action === 'sync') {
    await sync();
  }
});
```

**Cost:** ~$0.50 per million pushes (FCM/APNs). Negligible.

### How It All Flows

**Scenario 1: Same user, multiple devices (personal sync)**

```
You save note on iPhone
    ↓
Server receives save
    ↓
Server notifies YOUR other devices (not the iPhone that saved):
  - Your web tab → Realtime ping → syncs
  - Your iPad → silent push → syncs
  - Your Android → silent push → syncs
    ↓
All your devices up to date
```

**Scenario 2: Shared note with another user**

```
User B saves shared note on phone
    ↓
Server receives save
    ↓
Server notifies:
  - User B's other devices (personal sync)
  - User A's ALL devices (collaborator sync)
    ↓
Everyone up to date
```

### Server-Side Sync Trigger Logic

```typescript
async function onNoteSaved(note: Note, savedByUserId: string, savedByDeviceId: string) {
  const devicesToNotify: DeviceToken[] = [];

  // 1. ALWAYS: User's other devices (personal multi-device sync)
  const userDevices = await db
    .from('user_devices')
    .select('*')
    .eq('user_id', savedByUserId)
    .neq('id', savedByDeviceId); // Exclude device that saved
  devicesToNotify.push(...userDevices);

  // 2. If shared note (is_private = false): notify workspace members
  if (note.workspace_id && !note.is_private) {
    const members = await db
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', note.workspace_id)
      .neq('user_id', savedByUserId); // Don't notify the saver
    for (const member of members) {
      const devices = await getUserDevices(member.user_id);
      devicesToNotify.push(...devices);
    }
  }

  // Send notifications by platform
  const webDevices = devicesToNotify.filter((d) => d.platform === 'web');
  const mobileDevices = devicesToNotify.filter((d) => d.platform !== 'web');

  // Web: Realtime broadcast
  for (const device of webDevices) {
    await supabase.channel(`user:${device.user_id}:sync`).send({
      type: 'broadcast',
      event: 'sync',
    });
  }

  // Mobile: Silent push
  await sendPushNotifications(
    mobileDevices.map((d) => d.device_token),
    {
      data: { action: 'sync' },
      contentAvailable: true,
    }
  );
}
```

### Conflict Resolution: Line-Level Merge

When the same note is edited by two users, merge changes intelligently instead of losing data.

**Strategy:**

1. **Field-level first:** If only title OR content changed, no conflict
2. **Line-level merge for content:** Treat content as lines, merge additions from both sides
3. **Same-line conflict:** If both edited the same line, keep remote (rare edge case)

**Algorithm:**

```typescript
function mergeContent(base: string, local: string, remote: string): string {
  // If no base (new note), can't merge - remote wins
  if (!base) return remote;

  // If identical, no conflict
  if (local === remote) return local;

  const baseLines = base.split('\n');
  const localLines = local.split('\n');
  const remoteLines = remote.split('\n');

  const result: string[] = [];
  const maxLen = Math.max(baseLines.length, localLines.length, remoteLines.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = baseLines[i] ?? '';
    const localLine = localLines[i] ?? '';
    const remoteLine = remoteLines[i] ?? '';

    if (localLine === remoteLine) {
      // Same change or no change - keep it
      result.push(localLine);
    } else if (localLine === baseLine) {
      // Only remote changed - take remote
      result.push(remoteLine);
    } else if (remoteLine === baseLine) {
      // Only local changed - take local
      result.push(localLine);
    } else {
      // Both changed same line - keep both (remote first, then local)
      if (remoteLine) result.push(remoteLine);
      if (localLine && localLine !== remoteLine) result.push(localLine);
    }
  }

  // Remove trailing empty lines, dedupe
  return [...new Set(result)].join('\n').trimEnd();
}
```

**Example - Shopping List:**

```
Base:           User A:         User B:         Merged:
- Milk          - Milk          - Milk          - Milk
- Eggs          - Eggs          - Eggs          - Eggs
                - Bread         - Butter        - Bread   ← A's addition
                                                - Butter  ← B's addition
```

**Edge cases:**

- Both delete same line → stays deleted
- Both edit same line differently → keep both versions (rare, user can clean up)
- One deletes, one edits → keep the edit

### When to Sync

| Event            | Action                           |
| ---------------- | -------------------------------- |
| App opens        | Pull all changes since last sync |
| Note saved       | Push that note immediately       |
| App backgrounded | Push any pending changes         |
| Every 60s        | Background sync if app is open   |
| Pull-to-refresh  | Manual sync trigger              |

---

## Scaling Recommendations

1. **No Realtime for MVP** - Polling is simpler and free
2. **Test early on all platforms** - Catch RN Web issues before you're deep in
3. **Keep Supabase Edge Functions simple** - Easy to port if needed
4. **Monitor costs** - Set up Supabase billing alerts from day 1

---

## Next Steps

1. Create Expo project: `npx create-expo-app notes-app`
2. Set up Supabase project
3. Run database schema
4. Implement auth (Supabase Auth + Expo)
5. Build notes CRUD
6. Continue through phases...

---

## References

- Simplenote Web (UI inspiration): https://github.com/Automattic/simplenote-electron
- WatermelonDB: https://watermelondb.dev/
- Supabase: https://supabase.com/docs
- Expo: https://docs.expo.dev/
- Stripe Subscriptions: https://stripe.com/docs/billing/subscriptions
