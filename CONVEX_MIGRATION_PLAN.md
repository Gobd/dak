# Convex Migration Plan

Unified backend for all Supabase apps with shared auth and flexible sharing patterns.

## Apps to Migrate

1. **tracker** - Personal alcohol tracking (no sharing)
2. **maintenance-tracker** - Household maintenance (everyone shares everything)
3. **family-chores** - Chore management (parent/kid roles)
4. **health-tracker** - Medication tracking (owner + caregivers)
5. **notes-app** - Notes with auto-share + one-off sharing

## Architecture

```
apps/
  notes-app/                  # Standalone notes (PWA)
  health-tracker/             # Standalone health (PWA)
  family-chores/              # Standalone chores (PWA)
  maintenance-tracker/        # Standalone maintenance (PWA)
  tracker/                    # Standalone alcohol tracker (PWA)
  people/                     # Standalone "My People" management (PWA)
  dak/                        # NEW: Unified app - all apps in one (PWA)

packages/
  convex/                     # Shared Convex backend
    lib/                     # Pure TypeScript (NO Convex imports)
      sharing.ts             # Permission logic (portable)
      validation.ts          # Input validation (portable)
      scheduling.ts          # Due date calculations (portable)
    convex/
      schema.ts              # All tables
      _lib/                  # Convex-specific helpers
        auth.ts              # Auth helpers (uses ctx)
        db.ts                # DB query helpers (uses ctx)
      tracker/               # Thin wrappers → call lib/
      maintenance/           # Thin wrappers → call lib/
      chores/                # Thin wrappers → call lib/
      health/                # Thin wrappers → call lib/
      notes/                 # Thin wrappers → call lib/
      people/                # Thin wrappers → call lib/

  data/                       # Frontend data hooks (abstracts Convex)
    src/
      notes.ts               # useNotes(), useCreateNote(), etc.
      health.ts              # useMedications(), useLogMedication(), etc.
      chores.ts              # useChores(), useCompleteChore(), etc.
      maintenance.ts         # useTasks(), useLogCompletion(), etc.
      people.ts              # usePeople(), useAddPerson(), etc.
      index.ts               # Re-exports all

  # Shared UI packages (consumed by standalone + unified apps)
  notes-ui/                   # Notes UI components
  health-ui/                  # Health UI components
  chores-ui/                  # Chores UI components
  maintenance-ui/             # Maintenance UI components
  tracker-ui/                 # Tracker UI components
  people-ui/                  # People management UI components
  sharing-ui/                 # Sharing components (bell, dialogs, quick-add)
```

One Convex project, one deployment, all apps connect to same backend.

**Deployment strategy:** Both standalone apps AND unified app are deployed. Users can:
- Use standalone apps for focused single-purpose access
- Use unified `dak` app for everything in one place

## Backend Portability

Designed to allow migration from Convex to self-hosted (Soketi + Postgres + FastAPI) if costs become prohibitive at scale.

### Cost Comparison at Scale

| Users | Convex Cloud | Self-hosted Convex | PlanetScale + Soketi |
|-------|--------------|--------------------|-----------------------|
| 100   | Free         | Overkill           | Free                  |
| 1k    | ~$25         | ~$20-40/mo         | ~$10/mo               |
| 10k   | $300+        | ~$50-100/mo        | ~$40/mo               |

**Recommended path:** Convex Cloud → Self-hosted Convex (no code changes needed)

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
│ components/ → use hooks from packages/data/                  │
│              (never import Convex directly)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ DATA HOOKS (packages/data/)                                  │
│ useNotes(), useMedications(), etc.                          │
│ Wraps Convex calls - swap implementation here later          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (packages/convex/)                                   │
│                                                              │
│ convex/          - Thin wrappers (Convex-specific)          │
│   notes/queries.ts   → calls lib/ functions                 │
│   notes/mutations.ts → calls lib/ functions                 │
│                                                              │
│ lib/             - Pure TypeScript (NO Convex imports)      │
│   sharing.ts         → permission logic                     │
│   validation.ts      → input validation                     │
│   scheduling.ts      → due date calculations                │
└─────────────────────────────────────────────────────────────┘
```

### Pure Business Logic (lib/)

All permission checks, validation, and business rules in pure TypeScript. No Convex imports - receives data as arguments, returns results.

```typescript
// packages/convex/lib/sharing.ts - PURE TypeScript, portable

// Types (no Convex dependencies)
interface Note { ownerId: string }
interface Person { ownerId: string; notesAutoShare: boolean }
interface NoteShare { sharedWithId: string; status: string }

// Pure function - takes data, returns result
export function canAccessNote(
  note: Note,
  userId: string,
  autoSharePeople: Person[],
  noteShares: NoteShare[]
): { canAccess: boolean; isOwner: boolean } {
  // Owner
  if (note.ownerId === userId) {
    return { canAccess: true, isOwner: true };
  }

  // Auto-share via "My People"
  if (autoSharePeople.some(p => p.ownerId === note.ownerId && p.notesAutoShare)) {
    return { canAccess: true, isOwner: false };
  }

  // One-off share
  if (noteShares.some(s => s.sharedWithId === userId && s.status === 'accepted')) {
    return { canAccess: true, isOwner: false };
  }

  return { canAccess: false, isOwner: false };
}

// More pure functions...
export function canKidCompleteChore(role: string, choreAssigneeId: string, userId: string): boolean {
  if (role === 'kid' && choreAssigneeId !== userId) return false;
  return true;
}

export function isSubscriptionActive(user: {
  isPermanentlyPaid?: boolean;
  trialEndsAt: number;
  subscriptionStatus?: string;
  subscriptionEndedAt?: number;
}): boolean {
  if (user.isPermanentlyPaid) return true;

  const now = Date.now();
  const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

  if (now < user.trialEndsAt) return true;
  if (user.subscriptionStatus === 'active') return true;
  if (user.subscriptionEndedAt && now < user.subscriptionEndedAt + GRACE_PERIOD_MS) return true;

  return false;
}
```

### Thin Convex Wrappers

Convex functions only do: auth, fetch data, call pure functions, persist results.

```typescript
// packages/convex/convex/notes/queries.ts
import { canAccessNote } from '../lib/sharing';

export const get = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    // 1. Auth
    const user = await requireUser(ctx);

    // 2. Fetch data
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error("Not found");

    const autoSharePeople = await ctx.db
      .query("people")
      .withIndex("by_user_status", q => q.eq("userId", user.subject).eq("status", "accepted"))
      .collect();

    const noteShares = await ctx.db
      .query("noteShares")
      .withIndex("by_note", q => q.eq("noteId", noteId))
      .collect();

    // 3. Call pure function (portable logic)
    const { canAccess } = canAccessNote(note, user.subject, autoSharePeople, noteShares);
    if (!canAccess) throw new Error("Forbidden");

    // 4. Return
    return note;
  },
});
```

### Frontend Data Hooks (packages/data/)

Components never import Convex directly. Use hooks that wrap the implementation.

```typescript
// packages/data/src/notes.ts
import { useQuery, useMutation } from 'convex/react';
import { api } from '@dak/convex';

export function useNotes() {
  return useQuery(api.notes.list);
}

export function useNote(noteId: string) {
  return useQuery(api.notes.get, { noteId });
}

export function useCreateNote() {
  return useMutation(api.notes.create);
}

export function useUpdateNote() {
  return useMutation(api.notes.update);
}

// packages/data/src/health.ts
export function useMedicationLogs(childId: string) {
  return useQuery(api.health.listLogs, { childId });
}

export function useLogMedication() {
  return useMutation(api.health.logMedication);
}
```

**Components use hooks:**

```tsx
// Any component
import { useNotes, useCreateNote } from '@dak/data';

function NotesList() {
  const notes = useNotes();  // Don't know/care it's Convex
  const createNote = useCreateNote();
  // ...
}
```

### Migration to Self-Hosted Later

**Option A: Self-hosted Convex (Recommended)**

Convex is open source (FSL Apache 2.0). Self-host when costs get high - no code changes needed.

```bash
# It's just Docker Compose
docker compose up
docker compose exec backend ./generate_admin_key.sh
```

| Component | Service | Cost at 10k users |
|-----------|---------|-------------------|
| Convex backend + dashboard | Fly.io (2 instances) | $15-20/mo |
| Database | Fly Postgres | $0-7/mo |
| Static hosting | Cloudflare Pages | Free |
| **Total** | | **~$20-30/mo** |

**Migration:** Change `CONVEX_URL` from cloud to your server. Done.

**Option B: Full rewrite (PlanetScale + Soketi + FastAPI)**

More work, slightly cheaper, but requires rewriting API layer.

| Component | Service | Cost at 10k users |
|-----------|---------|-------------------|
| Database | PlanetScale (managed MySQL) | $29/mo |
| Realtime | Soketi (self-hosted VPS) | $10/mo |
| API | FastAPI (same VPS) | $0 |
| Static hosting | Cloudflare Pages | Free |
| **Total** | | **~$40/mo** |

**Recommendation:** Start with Convex Cloud, migrate to self-hosted Convex if needed. Only consider Option B if self-hosted Convex doesn't work out for some reason.

1. **lib/** - Copy as-is (or port to Python if using FastAPI)
2. **convex/** - Rewrite wrappers for FastAPI + SQLAlchemy
3. **packages/data/** - Swap implementations:

```typescript
// packages/data/src/notes.ts - AFTER migration

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api-client';  // REST client
import { useChannel } from '../realtime';  // Soketi

export function useNotes() {
  const query = useQuery(['notes'], () => api.notes.list());

  // Listen for realtime updates
  useChannel('notes', {
    'note:created': (data) => query.setData(prev => [...prev, data]),
    'note:updated': (data) => query.setData(prev =>
      prev.map(n => n.id === data.id ? data : n)
    ),
    'note:deleted': ({ id }) => query.setData(prev =>
      prev.filter(n => n.id !== id)
    ),
  });

  return query.data;
}
```

**Components unchanged** - same hook API, different implementation.

### Realtime Pattern: Minimal Data Transfer

Don't send "data changed, refetch all". Send the changed record in the event.

**Event includes payload:**
```typescript
// Backend broadcasts after mutation
broadcast('health:medication_logged', {
  id: '123',
  childId: '456',
  medicationId: '789',
  administeredBy: 'user-id',
  administeredAt: 1706123456000,
  notes: 'Took with food'
});

// Client updates local state directly - no refetch
onEvent('health:medication_logged', (log) => {
  setLogs(prev => [...prev, log]);
});
```

**For updates, send the full updated record:**
```typescript
broadcast('notes:updated', {
  id: '123',
  title: 'New Title',
  content: '...',
  updatedAt: 1706123456000
});

onEvent('notes:updated', (note) => {
  setNotes(prev => prev.map(n => n.id === note.id ? note : n));
});
```

**Convex does this automatically** via reactive queries (sends minimal diffs). When migrating to Soketi, design events to include full changed records.

### Summary

| Layer | Convex Cloud | Self-hosted Convex | PlanetScale + Soketi |
|-------|--------------|--------------------|-----------------------|
| **Code changes** | - | None | Rewrite API layer |
| **lib/** | Pure TypeScript | Same | Same (or Python) |
| **Database** | Convex DB | Postgres/SQLite | PlanetScale |
| **Backend** | Convex functions | Same | FastAPI |
| **Data hooks** | useQuery(api.x) | Same | React Query + Soketi |
| **Realtime** | Automatic | Same | Soketi channels |
| **Cost at 10k** | ~$300+/mo | ~$50-80/mo | ~$40/mo |

## Sharing Model: "My People"

Unified sharing across all apps. One place to manage who has access to what.

### Two Layers

1. **My People** - Your inner circle with per-app permissions
2. **One-off note shares** - Share specific notes with anyone (doesn't add to My People)

### Example: Grandparents

Grandparents are caregivers for health-tracker but shouldn't see all your notes:

```
Grandma in "My People":
  - maintenanceAccess: false     # don't need household stuff
  - choresRole: null             # not in chore rotation
  - healthCaregiverFor: [kid1, kid2]  # can see/log meds
  - notesAutoShare: false        # NOT all your notes

One-off note share:
  - noteId: "kids-present-ideas"
  - sharedWith: grandma
  - role: "viewer"
```

**Grandma sees:**
- ✓ Kids' medications in health-tracker
- ✓ Just the "present ideas" note
- ✗ Your other personal notes
- ✗ Maintenance tasks
- ✗ Family chores

## Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // USERS & AUTH
  // ============================================
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),

    // Subscription
    trialEndsAt: v.number(),                   // timestamp
    subscriptionStatus: v.optional(v.string()), // "active" | "canceled" | "past_due"
    subscriptionEndedAt: v.optional(v.number()),

    // VIP - bypasses all subscription checks
    isPermanentlyPaid: v.optional(v.boolean()), // for you + early testers
  })
    .index("by_auth", ["authId"])
    .index("by_email", ["email"]),

  // ============================================
  // MY PEOPLE (unified sharing)
  // ============================================

  // People you share with across apps
  // Requires acceptance - can't add someone to your family without their consent
  people: defineTable({
    ownerId: v.string(),                    // you
    userId: v.string(),                      // them (their auth ID, empty if not registered)
    email: v.string(),                       // for display / invite lookup
    name: v.optional(v.string()),            // optional display name

    // Status: pending until they accept
    status: v.string(),                      // "pending" | "accepted" | "rejected"

    // Per-app permissions (only active when accepted)
    maintenanceAccess: v.boolean(),          // can see household tasks
    choresRole: v.optional(v.string()),      // "parent" | "kid" | null
    healthCaregiverFor: v.array(v.string()), // child IDs they can access
    notesAutoShare: v.boolean(),             // auto-share all notes

    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_owner_user", ["ownerId", "userId"]),

  // One-off note shares (specific note to anyone)
  // Simple model: shared = can edit (no viewer/editor distinction)
  noteShares: defineTable({
    noteId: v.id("notes"),
    ownerId: v.string(),                     // note owner (for easy querying)
    sharedWithEmail: v.string(),             // who it's shared with
    sharedWithId: v.optional(v.string()),    // their auth ID (if registered)
    status: v.string(),                      // "pending" | "accepted" | "rejected"
    createdAt: v.number(),
  })
    .index("by_note", ["noteId"])
    .index("by_shared_with", ["sharedWithId"])
    .index("by_shared_with_status", ["sharedWithId", "status"])
    .index("by_owner", ["ownerId"]),

  // Blocked users (for share spam prevention)
  blockedUsers: defineTable({
    userId: v.string(),                      // who blocked
    blockedUserId: v.string(),               // who's blocked
    blockedEmail: v.string(),                // for display
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_blocked", ["userId", "blockedUserId"]),

  // ============================================
  // TRACKER (personal, no sharing)
  // ============================================
  trackerEntries: defineTable({
    userId: v.string(),
    date: v.string(),                        // YYYY-MM-DD
    drinks: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ============================================
  // MAINTENANCE TRACKER
  // ============================================
  maintenanceTasks: defineTable({
    ownerId: v.string(),                     // who created/owns
    title: v.string(),
    description: v.optional(v.string()),
    frequency: v.optional(v.string()),       // "monthly", "yearly", etc.
    lastCompleted: v.optional(v.number()),
    nextDue: v.optional(v.string()),         // YYYY-MM-DD
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"]),

  maintenanceLogs: defineTable({
    taskId: v.id("maintenanceTasks"),
    completedBy: v.string(),
    completedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_task", ["taskId"]),

  // ============================================
  // FAMILY CHORES
  // ============================================
  chores: defineTable({
    ownerId: v.string(),                     // family "owner" (parent who set up)
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.string()),      // who's assigned
    dueDate: v.optional(v.string()),
    recurring: v.optional(v.string()),       // "daily", "weekly", etc.
    completedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_assignee", ["assigneeId"]),

  // ============================================
  // HEALTH TRACKER
  // ============================================
  children: defineTable({
    ownerId: v.string(),                     // parent who created
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"]),

  medications: defineTable({
    childId: v.id("children"),
    name: v.string(),
    dosage: v.optional(v.string()),
    frequency: v.optional(v.string()),
    instructions: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_child", ["childId"]),

  medicationLogs: defineTable({
    medicationId: v.id("medications"),
    childId: v.id("children"),               // denormalized for easy querying
    administeredBy: v.string(),
    administeredAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_medication", ["medicationId"])
    .index("by_child", ["childId"])
    .index("by_date", ["administeredAt"]),

  // ============================================
  // NOTES APP
  // ============================================
  notes: defineTable({
    ownerId: v.string(),
    title: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_updated", ["updatedAt"]),
});
```

## Auth Helpers

**Key principle:** Viewing shared content = free. Creating your own content = requires trial/subscription.

This means grandma can view your shared notes and kids' health data forever (you paid). But if grandma wants to create her own notes or track her own stuff, she needs her own trial/subscription.

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "../_generated/server";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Basic auth - just logged in
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

// For creating/writing YOUR OWN content - requires active trial/subscription
export async function requireActiveUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const dbUser = await ctx.db
    .query("users")
    .withIndex("by_auth", (q) => q.eq("authId", identity.subject))
    .first();

  if (!dbUser) throw new Error("User not found");

  // VIP bypass - you + early testers
  if (dbUser.isPermanentlyPaid) {
    return { user: identity, dbUser };
  }

  const now = Date.now();
  const inTrial = now < dbUser.trialEndsAt;
  const isActive = dbUser.subscriptionStatus === "active";
  const inGrace = dbUser.subscriptionEndedAt &&
                  now < dbUser.subscriptionEndedAt + GRACE_PERIOD_MS;

  if (!inTrial && !isActive && !inGrace) {
    throw new Error("SUBSCRIPTION_REQUIRED");
  }

  return { user: identity, dbUser };
}
```

**When to use each:**

| Action | Auth Check |
|--------|------------|
| View shared notes | `requireUser` + access check |
| Edit shared notes | `requireUser` + access check |
| View shared health data | `requireUser` + access check |
| Log medication for shared child | `requireUser` + caregiver check |
| Complete shared chore | `requireUser` + role check |
| Create your own note | `requireActiveUser` |
| Create your own child/medication | `requireActiveUser` |
| Add to "My People" | `requireActiveUser` |
| Create maintenance task | `requireActiveUser` |
| Create chore | `requireActiveUser` |

**Free forever:** View, edit, and interact with content shared WITH you.
**Requires subscription:** Create your own top-level content.

**Owner vs Shared User permissions by app:**

| App | Owner can | Shared user can |
|-----|-----------|-----------------|
| health-tracker | Add/edit/delete children & meds | Log doses only |
| family-chores | Create/edit/delete chores | Complete assigned chores |
| maintenance | Create/edit/delete tasks | Mark complete, add logs |
| notes | Create notes, manage sharing | Edit shared notes |

Owner controls the structure, shared users interact with it. This keeps parents in control (especially important for medications).

## Sharing Helpers

```typescript
// convex/lib/sharing.ts
import { QueryCtx } from "../_generated/server";

// Get someone from "My People" (only if accepted)
export async function getPerson(
  ctx: QueryCtx,
  ownerId: string,
  userId: string
) {
  const person = await ctx.db
    .query("people")
    .withIndex("by_owner_user", (q) =>
      q.eq("ownerId", ownerId).eq("userId", userId)
    )
    .first();

  // Only return if they've accepted the invite
  if (person?.status !== "accepted") return null;
  return person;
}

// Get all people who share with me (I'm in their "people" list, accepted only)
export async function getPeopleWhoShareWithMe(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("people")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", "accepted")
    )
    .collect();
}

// ============================================
// MAINTENANCE ACCESS
// ============================================
export async function canAccessMaintenance(
  ctx: QueryCtx,
  ownerId: string,
  userId: string
): Promise<boolean> {
  // Owner always has access
  if (ownerId === userId) return true;

  // Check if in owner's people with maintenance access
  const person = await getPerson(ctx, ownerId, userId);
  return person?.maintenanceAccess ?? false;
}

// ============================================
// CHORES ACCESS
// ============================================
export async function getChoresRole(
  ctx: QueryCtx,
  ownerId: string,
  userId: string
): Promise<"owner" | "parent" | "kid" | null> {
  // Owner is always "owner"
  if (ownerId === userId) return "owner";

  // Check if in owner's people with a chores role
  const person = await getPerson(ctx, ownerId, userId);
  if (!person?.choresRole) return null;
  return person.choresRole as "parent" | "kid";
}

// ============================================
// HEALTH ACCESS
// ============================================
export async function canAccessChild(
  ctx: QueryCtx,
  childId: string,
  userId: string
): Promise<{ canAccess: boolean; role: "owner" | "caregiver" | null }> {
  const child = await ctx.db.get(childId);
  if (!child) return { canAccess: false, role: null };

  // Owner always has access
  if (child.ownerId === userId) {
    return { canAccess: true, role: "owner" };
  }

  // Check if user is a caregiver for this child
  const person = await getPerson(ctx, child.ownerId, userId);
  if (person?.healthCaregiverFor?.includes(childId)) {
    return { canAccess: true, role: "caregiver" };
  }

  return { canAccess: false, role: null };
}

// ============================================
// NOTES ACCESS
// ============================================
// Simple model: owner or shared = can edit (no viewer/editor distinction)
export async function canAccessNote(
  ctx: QueryCtx,
  noteId: string,
  userId: string
): Promise<{ canAccess: boolean; isOwner: boolean }> {
  const note = await ctx.db.get(noteId);
  if (!note) return { canAccess: false, isOwner: false };

  // Owner
  if (note.ownerId === userId) {
    return { canAccess: true, isOwner: true };
  }

  // Check auto-share (in owner's "people" with notesAutoShare)
  const person = await getPerson(ctx, note.ownerId, userId);
  if (person?.notesAutoShare) {
    return { canAccess: true, isOwner: false };
  }

  // Check one-off share (only accepted shares grant access)
  const noteShare = await ctx.db
    .query("noteShares")
    .withIndex("by_note", (q) => q.eq("noteId", noteId))
    .filter((q) =>
      q.and(
        q.eq(q.field("sharedWithId"), userId),
        q.eq(q.field("status"), "accepted")
      )
    )
    .first();

  if (noteShare) {
    return { canAccess: true, isOwner: false };
  }

  return { canAccess: false, isOwner: false };
}
```

## App-Specific Patterns

### Tracker (No Sharing)

```typescript
// convex/tracker/queries.ts
export const list = query({
  args: { startDate: v.optional(v.string()), endDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const entries = await ctx.db
      .query("trackerEntries")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .collect();

    return entries.filter((e) => {
      if (args.startDate && e.date < args.startDate) return false;
      if (args.endDate && e.date > args.endDate) return false;
      return true;
    });
  },
});
```

### Maintenance Tracker

```typescript
// convex/maintenance/queries.ts
export const listTasks = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // My tasks
    const myTasks = await ctx.db
      .query("maintenanceTasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.subject))
      .collect();

    // Tasks shared with me
    const peopleWhoShareWithMe = await getPeopleWhoShareWithMe(ctx, user.subject);
    const sharedTasks = [];

    for (const person of peopleWhoShareWithMe) {
      if (person.maintenanceAccess) {
        const tasks = await ctx.db
          .query("maintenanceTasks")
          .withIndex("by_owner", (q) => q.eq("ownerId", person.ownerId))
          .collect();
        sharedTasks.push(...tasks);
      }
    }

    return { myTasks, sharedTasks };
  },
});
```

### Family Chores

```typescript
// convex/chores/mutations.ts
export const complete = mutation({
  args: { choreId: v.id("chores") },
  handler: async (ctx, { choreId }) => {
    const user = await requireUser(ctx);
    const chore = await ctx.db.get(choreId);
    if (!chore) throw new Error("Not found");

    const role = await getChoresRole(ctx, chore.ownerId, user.subject);
    if (!role) throw new Error("Forbidden");

    // Kids can only complete their own chores
    if (role === "kid" && chore.assigneeId !== user.subject) {
      throw new Error("Not your chore");
    }

    await ctx.db.patch(choreId, { completedAt: Date.now() });
  },
});

export const deleteChore = mutation({
  args: { choreId: v.id("chores") },
  handler: async (ctx, { choreId }) => {
    const user = await requireUser(ctx);
    const chore = await ctx.db.get(choreId);
    if (!chore) throw new Error("Not found");

    const role = await getChoresRole(ctx, chore.ownerId, user.subject);

    // Only owner or parent can delete
    if (role !== "owner" && role !== "parent") {
      throw new Error("Parents only");
    }

    await ctx.db.delete(choreId);
  },
});
```

### Health Tracker

```typescript
// convex/health/queries.ts
export const listChildren = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // My children
    const myChildren = await ctx.db
      .query("children")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.subject))
      .collect();

    // Children I'm caregiver for
    const peopleWhoShareWithMe = await getPeopleWhoShareWithMe(ctx, user.subject);
    const caregiverFor = [];

    for (const person of peopleWhoShareWithMe) {
      for (const childId of person.healthCaregiverFor || []) {
        const child = await ctx.db.get(childId);
        if (child) caregiverFor.push({ ...child, role: "caregiver" });
      }
    }

    return {
      myChildren: myChildren.map((c) => ({ ...c, role: "owner" })),
      caregiverFor,
    };
  },
});

export const listMedications = query({
  args: { childId: v.id("children") },
  handler: async (ctx, { childId }) => {
    const user = await requireUser(ctx);

    const { canAccess } = await canAccessChild(ctx, childId, user.subject);
    if (!canAccess) throw new Error("Forbidden");

    return ctx.db
      .query("medications")
      .withIndex("by_child", (q) => q.eq("childId", childId))
      .collect();
  },
});
```

### Notes App

**Key optimization:** List view only syncs title + updatedAt. Full content only syncs for the one visible note.

```typescript
// convex/notes/queries.ts

// Light projection for list view - no content
type NoteListItem = {
  _id: Id<"notes">;
  title: string;
  updatedAt: number;
  ownerId: string;
  sharedBy?: string;
};

function toListItem(note: Doc<"notes">, sharedBy?: string): NoteListItem {
  return {
    _id: note._id,
    title: note.title,
    updatedAt: note.updatedAt,
    ownerId: note.ownerId,
    ...(sharedBy && { sharedBy }),
  };
}

// List - lightweight, always subscribed
export const list = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // My notes
    const owned = await ctx.db
      .query("notes")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.subject))
      .collect();

    // Notes auto-shared with me
    const peopleWhoShareWithMe = await getPeopleWhoShareWithMe(ctx, user.subject);
    const autoShared: NoteListItem[] = [];

    for (const person of peopleWhoShareWithMe) {
      if (person.notesAutoShare) {
        const notes = await ctx.db
          .query("notes")
          .withIndex("by_owner", (q) => q.eq("ownerId", person.ownerId))
          .collect();
        autoShared.push(...notes.map((n) => toListItem(n, person.ownerId)));
      }
    }

    // Notes one-off shared with me (only accepted)
    const oneOffShares = await ctx.db
      .query("noteShares")
      .withIndex("by_shared_with_status", (q) =>
        q.eq("sharedWithId", user.subject).eq("status", "accepted")
      )
      .collect();

    const oneOffShared: NoteListItem[] = [];
    for (const share of oneOffShares) {
      const note = await ctx.db.get(share.noteId);
      if (note) {
        oneOffShared.push(toListItem(note, share.ownerId));
      }
    }

    return {
      owned: owned.map((n) => toListItem(n)),
      autoShared,
      oneOffShared,
    };
  },
});

// Single note - full content, only subscribed when viewing
export const get = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const user = await requireUser(ctx);

    const { canAccess } = await canAccessNote(ctx, noteId, user.subject);
    if (!canAccess) throw new Error("Forbidden");

    return ctx.db.get(noteId); // Full note with content
  },
});

// Server-side search - searches content but returns light results
export const search = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const user = await requireUser(ctx);
    const lowerTerm = term.toLowerCase();

    // Get all accessible notes (need full docs for content search)
    const owned = await ctx.db
      .query("notes")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.subject))
      .collect();

    const peopleWhoShareWithMe = await getPeopleWhoShareWithMe(ctx, user.subject);
    const autoShared: Doc<"notes">[] = [];
    for (const person of peopleWhoShareWithMe) {
      if (person.notesAutoShare) {
        const notes = await ctx.db
          .query("notes")
          .withIndex("by_owner", (q) => q.eq("ownerId", person.ownerId))
          .collect();
        autoShared.push(...notes);
      }
    }

    const oneOffShares = await ctx.db
      .query("noteShares")
      .withIndex("by_shared_with_status", (q) =>
        q.eq("sharedWithId", user.subject).eq("status", "accepted")
      )
      .collect();

    const oneOffShared: Doc<"notes">[] = [];
    for (const share of oneOffShares) {
      const note = await ctx.db.get(share.noteId);
      if (note) oneOffShared.push(note);
    }

    const allNotes = [...owned, ...autoShared, ...oneOffShared];

    // Filter by search term, return light results
    return allNotes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(lowerTerm) ||
          n.content.toLowerCase().includes(lowerTerm)
      )
      .map((n) => toListItem(n));
  },
});
```

### My People Management

```typescript
// convex/people/mutations.ts
export const addPerson = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    maintenanceAccess: v.boolean(),
    choresRole: v.optional(v.string()),
    healthCaregiverFor: v.array(v.string()),
    notesAutoShare: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Find user by email
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    // Check if already in people
    if (targetUser) {
      const existing = await getPerson(ctx, user.subject, targetUser.authId);
      if (existing) throw new Error("Already in your people");
    }

    // Check if they've blocked you
    if (targetUser) {
      const blocked = await ctx.db
        .query("blockedUsers")
        .withIndex("by_user_blocked", (q) =>
          q.eq("userId", targetUser.authId).eq("blockedUserId", user.subject)
        )
        .first();

      if (blocked) {
        // Silently succeed - don't reveal they've blocked you
        return;
      }
    }

    await ctx.db.insert("people", {
      ownerId: user.subject,
      userId: targetUser?.authId ?? "",  // empty if not registered yet
      email: args.email,
      name: args.name,
      status: "pending",  // requires their acceptance
      maintenanceAccess: args.maintenanceAccess,
      choresRole: args.choresRole,
      healthCaregiverFor: args.healthCaregiverFor,
      notesAutoShare: args.notesAutoShare,
      createdAt: Date.now(),
    });
  },
});

// Accept/reject family invite
export const respondToFamilyInvite = mutation({
  args: {
    personId: v.id("people"),
    accept: v.boolean(),
    block: v.optional(v.boolean()),
  },
  handler: async (ctx, { personId, accept, block }) => {
    const user = await requireUser(ctx);
    const person = await ctx.db.get(personId);

    if (!person || person.userId !== user.subject) {
      throw new Error("Not found");
    }

    if (person.status !== "pending") {
      throw new Error("Already responded");
    }

    await ctx.db.patch(personId, {
      status: accept ? "accepted" : "rejected",
    });

    // Optionally block this person
    if (block && !accept) {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_auth", (q) => q.eq("authId", person.ownerId))
        .first();

      await ctx.db.insert("blockedUsers", {
        userId: user.subject,
        blockedUserId: person.ownerId,
        blockedEmail: owner?.email ?? "unknown",
        createdAt: Date.now(),
      });
    }
  },
});

// List pending family invites for current user
export const listPendingFamilyInvites = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const pending = await ctx.db
      .query("people")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user.subject).eq("status", "pending")
      )
      .collect();

    // Get owner info for display
    const withOwners = await Promise.all(
      pending.map(async (invite) => {
        const owner = await ctx.db
          .query("users")
          .withIndex("by_auth", (q) => q.eq("authId", invite.ownerId))
          .first();
        return {
          ...invite,
          ownerName: owner?.name ?? owner?.email ?? "Unknown",
          ownerEmail: owner?.email,
        };
      })
    );

    return withOwners;
  },
});

export const updatePerson = mutation({
  args: {
    personId: v.id("people"),
    maintenanceAccess: v.optional(v.boolean()),
    choresRole: v.optional(v.string()),
    healthCaregiverFor: v.optional(v.array(v.string())),
    notesAutoShare: v.optional(v.boolean()),
  },
  handler: async (ctx, { personId, ...updates }) => {
    const user = await requireUser(ctx);
    const person = await ctx.db.get(personId);

    if (!person || person.ownerId !== user.subject) {
      throw new Error("Not found");
    }

    await ctx.db.patch(personId, updates);
  },
});

export const removePerson = mutation({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    const user = await requireUser(ctx);
    const person = await ctx.db.get(personId);

    if (!person || person.ownerId !== user.subject) {
      throw new Error("Not found");
    }

    await ctx.db.delete(personId);
  },
});

// convex/people/queries.ts
export const list = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return ctx.db
      .query("people")
      .withIndex("by_owner", (q) => q.eq("ownerId", user.subject))
      .collect();
  },
});
```

### One-Off Note Sharing

```typescript
// convex/notes/mutations.ts
// Simple: share a note = they can edit. No role complexity.
export const shareNote = mutation({
  args: {
    noteId: v.id("notes"),
    email: v.string(),
  },
  handler: async (ctx, { noteId, email }) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(noteId);

    if (!note || note.ownerId !== user.subject) {
      throw new Error("Not found or not owner");
    }

    // Check if already shared
    const existing = await ctx.db
      .query("noteShares")
      .withIndex("by_note", (q) => q.eq("noteId", noteId))
      .filter((q) => q.eq(q.field("sharedWithEmail"), email))
      .first();

    if (existing) throw new Error("Already shared with this person");

    // Find user if they exist
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    // Check if recipient has blocked the sharer - silently ignore
    if (targetUser) {
      const blocked = await ctx.db
        .query("blockedUsers")
        .withIndex("by_user_blocked", (q) =>
          q.eq("userId", targetUser.authId).eq("blockedUserId", user.subject)
        )
        .first();

      if (blocked) {
        // Silently succeed - don't reveal they're blocked
        return;
      }
    }

    // Auto-accept if sharer is in recipient's "My People"
    // (they already trust you, no approval needed)
    let status = "pending";
    if (targetUser) {
      const inTheirPeople = await getPerson(ctx, targetUser.authId, user.subject);
      if (inTheirPeople) {
        status = "accepted";
      }
    }

    await ctx.db.insert("noteShares", {
      noteId,
      ownerId: user.subject,
      sharedWithEmail: email,
      sharedWithId: targetUser?.authId,
      status,
      createdAt: Date.now(),
    });
  },
});

// Accept/reject pending shares (with optional block)
export const respondToShare = mutation({
  args: {
    shareId: v.id("noteShares"),
    accept: v.boolean(),
    block: v.optional(v.boolean()),  // block future shares from this person
  },
  handler: async (ctx, { shareId, accept, block }) => {
    const user = await requireUser(ctx);
    const share = await ctx.db.get(shareId);

    if (!share || share.sharedWithId !== user.subject) {
      throw new Error("Not found");
    }

    if (share.status !== "pending") {
      throw new Error("Already responded");
    }

    await ctx.db.patch(shareId, {
      status: accept ? "accepted" : "rejected",
    });

    // Optionally block this person
    if (block && !accept) {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_auth", (q) => q.eq("authId", share.ownerId))
        .first();

      await ctx.db.insert("blockedUsers", {
        userId: user.subject,
        blockedUserId: share.ownerId,
        blockedEmail: owner?.email ?? share.sharedWithEmail,
        createdAt: Date.now(),
      });
    }
  },
});

// Unblock a user
export const unblockUser = mutation({
  args: { blockedUserId: v.string() },
  handler: async (ctx, { blockedUserId }) => {
    const user = await requireUser(ctx);

    const block = await ctx.db
      .query("blockedUsers")
      .withIndex("by_user_blocked", (q) =>
        q.eq("userId", user.subject).eq("blockedUserId", blockedUserId)
      )
      .first();

    if (block) {
      await ctx.db.delete(block._id);
    }
  },
});

// List blocked users
export const listBlockedUsers = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return ctx.db
      .query("blockedUsers")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .collect();
  },
});

// Query pending shares for current user
export const listPendingShares = query({
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const pending = await ctx.db
      .query("noteShares")
      .withIndex("by_shared_with_status", (q) =>
        q.eq("sharedWithId", user.subject).eq("status", "pending")
      )
      .collect();

    // Get note titles for display
    const withNotes = await Promise.all(
      pending.map(async (share) => {
        const note = await ctx.db.get(share.noteId);
        const owner = await ctx.db
          .query("users")
          .withIndex("by_auth", (q) => q.eq("authId", share.ownerId))
          .first();
        return {
          ...share,
          noteTitle: note?.title ?? "Untitled",
          ownerName: owner?.name ?? owner?.email ?? "Unknown",
        };
      })
    );

    return withNotes;
  },
});

export const unshareNote = mutation({
  args: { noteShareId: v.id("noteShares") },
  handler: async (ctx, { noteShareId }) => {
    const user = await requireUser(ctx);
    const share = await ctx.db.get(noteShareId);

    if (!share || share.ownerId !== user.subject) {
      throw new Error("Not found");
    }

    await ctx.db.delete(noteShareId);
  },
});
```

## Migration Order

### Phase 1: Setup + Tracker
- [ ] Create `packages/convex` with Convex project
- [ ] Set up Convex Auth (email/password)
- [ ] Implement users table + auth helpers
- [ ] Migrate `tracker` app (simplest, no sharing)
- [ ] Run parallel with Supabase, verify it works

### Phase 2: My People + Maintenance Tracker
- [ ] Add `people` table
- [ ] Implement people management UI (could be in dashboard settings or standalone)
- [ ] Add maintenance tables
- [ ] Migrate `maintenance-tracker` app
- [ ] Test sharing via "My People" maintenanceAccess flag

### Phase 3: Family Chores
- [ ] Add chores tables
- [ ] Implement parent/kid role from "My People"
- [ ] Migrate `family-chores` app
- [ ] Test role-based permissions (parents full, kids limited)

### Phase 4: Health Tracker
- [ ] Add children + medications tables
- [ ] Implement caregiver access from "My People" healthCaregiverFor
- [ ] Migrate `health-tracker` app
- [ ] Test: owner has full control, caregivers can view/log

### Phase 5: Notes App
- [ ] Add notes + noteShares tables
- [ ] Implement auto-share from "My People" notesAutoShare flag
- [ ] Implement one-off note sharing
- [ ] Move search to server-side
- [ ] Migrate `notes-app`
- [ ] Test: auto-share, one-off shares, search

### Phase 6: Sharing UI + People App
- [ ] Create `packages/sharing-ui/` with shared components
- [ ] Implement `NotificationBell`, `ShareDialog`, `AddPersonDialog`
- [ ] Create `apps/people/` standalone app using `@dak/people-ui` + `@dak/sharing-ui`
- [ ] Add sharing components to each app (quick-add from within apps)

### Phase 7: Dashboard Config to Convex
- [ ] Add `dashboardConfigs` table to schema (screens, panels, globalSettings)
- [ ] Create Convex queries/mutations for config CRUD
- [ ] Update dashboard to use Convex for logged-in users
- [ ] Keep local storage fallback for guest/kiosk mode
- [ ] Dashboard now part of paid product bundle (same auth as other apps)
- [ ] Real-time config sync + cloud backup = easier sell
- [ ] Edit config from anywhere (laptop, phone) → kiosk updates instantly via Convex subscriptions

Note: Most widget APIs (weather, calendar, AQI, UV) already call external APIs directly from client JS.

**Home-relay becomes optional** - only needed for local network hardware:
- Zigbee2MQTT (sensors/devices)
- Kasa (smart plugs)
- Wake-on-LAN
- AdGuard Home

Most users won't need home-relay. Power users self-host it for smart home control.

### Phase 8: Unified App (Optional)
- [ ] Extract existing app UIs into `packages/*-ui/` packages
- [ ] Create `apps/dak/` unified app
- [ ] Implement app switcher, settings, default app preference
- [ ] Add `userPreferences` table to schema
- [ ] Configure all apps as PWAs (manifest, service worker, icons)
- [ ] Update standalone apps to import from `*-ui` packages

### Phase 9: Cleanup
- [ ] Remove Supabase dependencies
- [ ] Delete old Supabase configs/clients
- [ ] Update CLAUDE.md documentation

### Phase 10: Monetization + Launch
- [ ] Form LLC
- [ ] Privacy Policy + Terms of Service pages
- [ ] Set up Polar.sh (or Lemon Squeezy)
- [ ] Add subscription webhook handler to Convex
- [ ] Implement trial/subscription checks in all apps
- [ ] Google OAuth verification (submit consent screen with legal URLs)
- [ ] Build landing page (`apps/landing/`)
  - [ ] Hero section - what DAK is
  - [ ] Feature breakdown - all apps included
  - [ ] Pricing - simple single tier
  - [ ] Screenshots/demo
  - [ ] Sign up / login links
- [ ] Custom domain setup (dak.app or similar)
- [ ] Launch 🚀
- [ ] Upgrade to Convex paid plan ($25/mo) when needed

## Admin Functions

```typescript
// convex/admin/mutations.ts
const ADMIN_EMAILS = ["your@email.com"]; // hardcode your email

export const grantPermanentAccess = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await requireUser(ctx);

    // Only you can do this
    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_auth", (q) => q.eq("authId", user.subject))
      .first();

    if (!dbUser || !ADMIN_EMAILS.includes(dbUser.email)) {
      throw new Error("Not admin");
    }

    // Find target user
    const target = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!target) throw new Error("User not found");

    await ctx.db.patch(target._id, { isPermanentlyPaid: true });
    return { success: true, email };
  },
});

export const revokePermanentAccess = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await requireUser(ctx);

    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_auth", (q) => q.eq("authId", user.subject))
      .first();

    if (!dbUser || !ADMIN_EMAILS.includes(dbUser.email)) {
      throw new Error("Not admin");
    }

    const target = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!target) throw new Error("User not found");

    await ctx.db.patch(target._id, { isPermanentlyPaid: false });
    return { success: true, email };
  },
});
```

Run from Convex dashboard or build a simple admin page later.

## Data Migration

Not a big concern - just you and wife using now. Manual copy/paste for notes is fine.

For apps with more data (tracker history, health logs), could write a simple migration script if needed, but probably not worth the effort for small datasets.

## Frontend Changes

Minimal changes per app:

```tsx
// Before (Supabase)
import { supabase } from '../lib/supabase';
const { data } = await supabase.from('notes').select('*');

// After (Convex)
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
const notes = useQuery(api.notes.list);
```

### Notes App - Minimal Sync Pattern

Only sync what's visible. List view gets titles only, selected note gets full content.

```tsx
// components/NotesList.tsx
function NotesList({ selectedId, onSelect }) {
  // Always subscribed - light data (title + updatedAt only)
  const { owned, autoShared, oneOffShared } = useQuery(api.notes.list) ?? {};
  const allNotes = [...(owned ?? []), ...(autoShared ?? []), ...(oneOffShared ?? [])];

  return (
    <ul>
      {allNotes.map(note => (
        <li key={note._id} onClick={() => onSelect(note._id)}>
          {note.title}
          <span>{formatDate(note.updatedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

// components/NoteEditor.tsx
function NoteEditor({ noteId }) {
  // Only subscribed when noteId is set - full content
  const note = useQuery(api.notes.get, noteId ? { noteId } : "skip");

  if (!note) return <EmptyState />;

  return <Editor content={note.content} />;
}

// App.tsx
function NotesApp() {
  const [selectedId, setSelectedId] = useState<Id<"notes"> | null>(null);

  return (
    <div className="flex">
      <NotesList selectedId={selectedId} onSelect={setSelectedId} />
      <NoteEditor noteId={selectedId} />
    </div>
  );
}
```

**Data synced at any moment:**
- 500 notes × ~50 bytes (title + updatedAt) = ~25KB
- 1 full note content = varies (only the visible one)

Switch notes → old content subscription dropped, new one starts. No content accumulation.

### Main changes:
- Replace Supabase client with Convex hooks
- Remove RealtimeSync components (not needed - Convex is reactive by default)
- Remove channel subscriptions (not needed)
- Update auth to use Convex Auth
- Add "My People" management UI somewhere (dashboard settings?)

## UI for "My People"

New top-level app: `apps/people/` (or `people-manager/`)

Standalone app for managing who has access to what across all your apps.

```
My People
─────────────────────────────────────────────────
| Name     | Maintenance | Chores | Health      | Notes      |
|----------|-------------|--------|-------------|------------|
| Sarah    | ✓           | Parent | All kids    | Auto-share |
| Grandma  | -           | -      | Kid1, Kid2  | -          |
| Jake     | ✓           | Kid    | -           | -          |
─────────────────────────────────────────────────
[+ Add Person]
```

Features:
- Add person by email
- Toggle per-app permissions
- For health: select which children they can access
- For chores: select parent/kid role
- Remove person (revokes all access)

## Sharing UI (`@dak/sharing-ui`)

Shared package for all sharing interactions. Any app can import these components.

### Components

```
packages/sharing-ui/
  NotificationBell.tsx        # Bell icon + dropdown for pending invites/shares
  ShareDialog.tsx             # Share with person (one-off or add to My People)
  AddPersonDialog.tsx         # Quick-add to My People with app-specific permission
  PendingInvites.tsx          # List pending family/share invites to accept/reject
  ShareBadge.tsx              # "Shared with X people" indicator
  PeopleQuickView.tsx         # Mini view of who has access (for app settings)
```

### Two Ways to Add People

**From any app (quick-add):** Add someone with just that app's permission.

```
┌─ Health Tracker ─────────────────────────┐
│ Add Caregiver                            │
├──────────────────────────────────────────┤
│ Email: [grandma@email.com           ]    │
│ Name:  [Grandma                     ]    │
│                                          │
│ Can access:                              │
│ ☑ Emma                                   │
│ ☐ Jack                                   │
│                                          │
│ [Cancel]                    [Add]        │
└──────────────────────────────────────────┘

→ Grandma added to "My People" with:
  healthCaregiverFor: ["emma-id"]
  (all other permissions: false/empty)
```

**From people app (full control):** Add someone with any combination of permissions.

```
┌─ People App ─────────────────────────────┐
│ Add Person                               │
├──────────────────────────────────────────┤
│ Email: [grandma@email.com           ]    │
│ Name:  [Grandma                     ]    │
│                                          │
│ Permissions:                             │
│ ┌────────────────────────────────────┐   │
│ │ Maintenance    [Off]               │   │
│ │ Chores         [None ▼]            │   │
│ │ Health         [Select kids ▼]     │   │
│ │                ☑ Emma  ☐ Jack      │   │
│ │ Notes          [Off]               │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [Cancel]                    [Add]        │
└──────────────────────────────────────────┘
```

### Updating Permissions

Same pattern - update from the app or from people app:

- **From health-tracker:** "Manage caregivers" → add/remove kids for existing people
- **From people app:** Full grid view, edit any permission for anyone

### Who Uses What

| App | Sharing Components Used |
|-----|------------------------|
| notes-app | `NotificationBell`, `ShareDialog` (one-off + auto-share) |
| health-tracker | `NotificationBell`, `AddPersonDialog` (caregiver quick-add) |
| family-chores | `NotificationBell`, `AddPersonDialog` (parent/kid quick-add) |
| maintenance-tracker | `NotificationBell`, `AddPersonDialog` (access quick-add) |
| tracker | `NotificationBell` only (no sharing) |
| people | All components (full management view) |

### People App Purpose

The people app provides the **complete view**:
- See everyone in one place
- See all permissions across all apps in a grid
- Add/edit/remove people with any combination of permissions
- Manage blocked users

Individual apps let you **quick-add** for their specific needs, but people app is where you go to see the full picture or make cross-app permission changes.

## Notifications UX

Bell icon in app headers. Shows badge count for pending invites/shares.

### People App - Family Invites

```
┌─────────────────────────────────────────┐
│ My People                    🔔(1)  ⚙️  │
└─────────────────────────────────────────┘
                                  ↓ click
┌─────────────────────────────────────────┐
│ Family Invites                          │
├─────────────────────────────────────────┤
│ 👤 bob@email.com wants to add you       │
│    to their family                      │
│    Permissions they're granting:        │
│    • Maintenance tasks ✓                │
│    • Auto-share notes ✓                 │
│    [Accept] [Decline] [Block & Decline] │
├─────────────────────────────────────────┤
│ ─────────────────────────────────────── │
│ Blocked Users (1)              [Manage] │
└─────────────────────────────────────────┘
```

### Notes App - Share Requests

```
┌─────────────────────────────────────────┐
│ Notes                        🔔(2)  ⚙️  │
└─────────────────────────────────────────┘
                                  ↓ click
┌─────────────────────────────────────────┐
│ Pending Shares                          │
├─────────────────────────────────────────┤
│ 📄 "Shopping List"                      │
│    from bob@email.com                   │
│    [Accept] [Decline] [Block & Decline] │
├─────────────────────────────────────────┤
│ 📄 "Trip Planning"                      │
│    from alice@email.com                 │
│    [Accept] [Decline] [Block & Decline] │
├─────────────────────────────────────────┤
│ ─────────────────────────────────────── │
│ Blocked Users (2)              [Manage] │
└─────────────────────────────────────────┘
```

Manage blocked → list of blocked emails with unblock button.

**Implementation:** Shared `<NotificationBell />` component in `@dak/ui`. Every app drops it in the header. One component queries all pending invites (family + note shares) from Convex.

```typescript
// @dak/ui
export function NotificationBell() {
  const familyInvites = useQuery(api.people.listPendingFamilyInvites);
  const noteShares = useQuery(api.notes.listPendingShares);
  const count = (familyInvites?.length ?? 0) + (noteShares?.length ?? 0);

  // Bell icon with badge, dropdown shows all pending
  // Accept/decline/block right from dropdown
}

// Any app
import { NotificationBell } from '@dak/ui';

function Header() {
  return (
    <header>
      <h1>Notes</h1>
      <NotificationBell />
    </header>
  );
}
```

**Dropdown behavior:**
- Family invites: Accept/decline in-place (no navigation)
- Note shares: "Accept & View" → accepts + navigates to `/notes/{noteId}`

No unified notification center needed. Just a shared component.

## Unified App (`apps/dak/`)

Single app that bundles all modules with an app switcher. Deploy alongside standalone apps.

### Schema Addition

```typescript
// Add to convex/schema.ts
userPreferences: defineTable({
  userId: v.string(),
  defaultApp: v.string(),              // "notes" | "health" | "chores" | "maintenance" | "tracker" | "people"
  enabledApps: v.array(v.string()),    // which apps show in switcher
  appOrder: v.optional(v.array(v.string())), // custom order in switcher
})
  .index("by_user", ["userId"]),
```

### App Structure

```
apps/dak/
  src/
    App.tsx                   # Router + shell
    components/
      AppShell.tsx            # Header, sidebar, notification bell
      AppSwitcher.tsx         # Dropdown or sidebar nav
      AppIcon.tsx             # Icon for each app type
    routes/
      index.tsx               # Redirects to default app
      notes.tsx               # <NotesModule />
      health.tsx              # <HealthModule />
      chores.tsx              # <ChoresModule />
      maintenance.tsx         # <MaintenanceModule />
      tracker.tsx             # <TrackerModule />
      people.tsx              # <PeopleModule />
      settings.tsx            # App preferences (default, order, enabled)
```

### App Switcher UI

```
┌─────────────────────────────────────────┐
│ [≡] Notes                      🔔  ⚙️   │
├─────────────────────────────────────────┤
│ ┌─────────────────┐                     │
│ │ 📝 Notes    ✓   │ ← current           │
│ │ 💊 Health       │                     │
│ │ ✅ Chores       │                     │
│ │ 🔧 Maintenance  │                     │
│ │ 🍺 Tracker      │                     │
│ │ 👥 People       │                     │
│ ├─────────────────┤                     │
│ │ ⚙️ Settings     │                     │
│ └─────────────────┘                     │
│                                         │
│          [Notes content here]           │
│                                         │
└─────────────────────────────────────────┘
```

### Settings Page

- **Default app** - which app opens on launch
- **Enabled apps** - toggle which apps appear in switcher
- **App order** - drag to reorder apps in switcher

### Shared UI Package Pattern

Each `*-ui` package exports the main module component:

```typescript
// packages/notes-ui/index.ts
export { NotesModule } from './NotesModule';
export { NotesList } from './components/NotesList';
export { NoteEditor } from './components/NoteEditor';
// ... other components for customization

// packages/notes-ui/NotesModule.tsx
export function NotesModule() {
  // Full notes UI with routing handled internally
  return (
    <NotesProvider>
      <Routes>
        <Route index element={<NotesList />} />
        <Route path=":id" element={<NoteEditor />} />
      </Routes>
    </NotesProvider>
  );
}
```

Standalone apps import and wrap:

```typescript
// apps/notes-app/src/App.tsx
import { NotesModule } from '@dak/notes-ui';

function App() {
  return (
    <ConvexProvider>
      <AuthProvider>
        <NotesModule />
      </AuthProvider>
    </ConvexProvider>
  );
}
```

Unified app imports all:

```typescript
// apps/dak/src/routes/notes.tsx
import { NotesModule } from '@dak/notes-ui';

export default function NotesRoute() {
  return <NotesModule />;
}
```

### Migration Considerations

When migrating existing apps:
1. Extract UI into `packages/*-ui/`
2. Update standalone app to import from package
3. Add route to unified app
4. Shared auth context from `packages/convex/`

## Open Questions

1. **Convex hosting**: Cloud ($25/mo) vs self-host?
   - Recommendation: Start with cloud, simpler ops

2. **Invites**: What if person isn't registered yet?
   - Store email in `people` table with empty `userId`
   - When they register, backfill `userId` by email match
   - They'll see shared content once they sign up

3. **Monetization** (if making this public):
   - Free trial: 30 days, full access
   - After trial: paywall, but data kept (pay to unlock)
   - 7-day grace period after subscription ends (for dunning emails)
   - Track `trialEndsAt`, `subscriptionStatus`, `subscriptionEndedAt` on user
   - Show in-app warning banner during grace period
   - Payment: Polar.sh (Convex recommended) or Lemon Squeezy
     - Both are merchant of record (handle tax/VAT for you)
     - Simple webhook integration for subscription status
     - May handle dunning emails automatically

4. **Limits:**
   - My People: 10 (same for trial and paid - full experience during trial)
   - Note shares per note: 50 (abuse prevention)
   - Trial = full access, just time-limited
