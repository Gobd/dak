# Soft Delete Implementation Plan

## Overview
Add soft-delete with a Trash feature to prevent accidental permanent data loss. Items remain recoverable for 30 days before automatic cleanup. Caregivers can view/restore trash for people they have access to.

## Decisions
- **Retention**: 30 days before permanent deletion
- **Caregiver access**: Yes - can view/restore trash for people they have access to
- **Availability**: Core feature for everyone (not paid-only)
- **Delete Forever**: Available immediately in Trash UI (don't have to wait 30 days)

---

## Tables with Soft Delete

| Table | Notes |
|-------|-------|
| `people` | Deleting hides all their items automatically |
| `shot_schedules` | Individual schedule deletion |
| `medicine_courses` | Individual course deletion |
| `prn_meds` | Individual med deletion |

**Keep hard delete** (low value, undo buttons exist, would clutter Trash):
- `shot_logs`
- `medicine_doses`
- `prn_logs`

---

## Implementation Steps

### 1. Schema Migration (`sql/soft-delete-migration.sql`)

```sql
-- Add deleted_at columns
ALTER TABLE people ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE shot_schedules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE medicine_courses ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE prn_meds ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial indexes for efficient filtering
CREATE INDEX idx_people_not_deleted ON people(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shot_schedules_not_deleted ON shot_schedules(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_medicine_courses_not_deleted ON medicine_courses(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_prn_meds_not_deleted ON prn_meds(id) WHERE deleted_at IS NULL;

-- Indexes for trash queries
CREATE INDEX idx_people_deleted ON people(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_shot_schedules_deleted ON shot_schedules(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_medicine_courses_deleted ON medicine_courses(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_prn_meds_deleted ON prn_meds(deleted_at) WHERE deleted_at IS NOT NULL;
```

### 2. Update SQL Helper Functions

```sql
-- Filter out deleted people from normal access
CREATE OR REPLACE FUNCTION ht_accessible_person_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM people WHERE user_id = auth.uid() AND deleted_at IS NULL
  UNION
  SELECT person_id FROM ht_sharing_access
  WHERE member_id = auth.uid()
  AND person_id IN (SELECT id FROM people WHERE deleted_at IS NULL);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Writable also filters deleted
CREATE OR REPLACE FUNCTION ht_writable_person_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM people WHERE user_id = auth.uid() AND deleted_at IS NULL
  UNION
  SELECT person_id FROM ht_sharing_access
  WHERE member_id = auth.uid() AND permission = 'co-owner'
  AND person_id IN (SELECT id FROM people WHERE deleted_at IS NULL);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

### 3. Types Updates (`src/types.ts`)

Add to Person, ShotSchedule, MedicineCourse, PrnMed:
```typescript
deleted_at?: string | null;
```

### 4. Store Updates

**people-store.ts, shots-store.ts, medicine-store.ts, prn-store.ts**

Change delete methods from `.delete()` to `.update({ deleted_at: new Date().toISOString() })`:

```typescript
// Example: people-store.ts
deletePerson: async (id: string) => {
  const { error } = await supabase
    .from("people")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (!error) {
    get().fetchPeople();
    broadcastSync({ type: "people" });
  }
}
```

### 5. Trash Store (`src/stores/trash-store.ts`) - NEW

```typescript
interface TrashState {
  deletedPeople: Person[];
  deletedSchedules: ShotSchedule[];
  deletedCourses: MedicineCourse[];
  deletedMeds: PrnMed[];
  loading: boolean;

  fetchTrash: () => Promise<void>;

  // Restore = set deleted_at to null
  restorePerson: (id: string) => Promise<void>;
  restoreSchedule: (id: string) => Promise<void>;
  restoreCourse: (id: string) => Promise<void>;
  restoreMed: (id: string) => Promise<void>;

  // Permanent delete = actual .delete()
  permanentlyDeletePerson: (id: string) => Promise<void>;
  permanentlyDeleteSchedule: (id: string) => Promise<void>;
  permanentlyDeleteCourse: (id: string) => Promise<void>;
  permanentlyDeleteMed: (id: string) => Promise<void>;

  emptyTrash: () => Promise<void>;
}
```

**Fetch trash queries** (need to query directly with `deleted_at IS NOT NULL`):
```typescript
// Deleted people I own or have access to
const { data: people } = await supabase
  .from("people")
  .select("*")
  .not("deleted_at", "is", null);

// Deleted schedules for non-deleted people I have access to
const { data: schedules } = await supabase
  .from("shot_schedules")
  .select("*, person:people(*)")
  .not("deleted_at", "is", null);
```

### 6. Trash Page (`src/pages/Trash.tsx`) - NEW

**UI Layout:**
```
┌─────────────────────────────────────────┐
│ Trash                       [Empty All] │
│ Items deleted after 30 days             │
├─────────────────────────────────────────┤
│ PEOPLE                                  │
│ ┌─────────────────────────────────────┐ │
│ │ Dad (deleted 3 days ago)            │ │
│ │ Includes 2 shots, 1 course, 3 meds  │ │
│ │ [Restore] [Delete Forever]          │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ SHOTS                                   │
│ ┌─────────────────────────────────────┐ │
│ │ Weekly B12 - Mom (deleted 5d ago)   │ │
│ │ [Restore] [Delete Forever]          │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ COURSES                                 │
│ (none)                                  │
├─────────────────────────────────────────┤
│ AS-NEEDED                               │
│ ┌─────────────────────────────────────┐ │
│ │ Ibuprofen - Kid (deleted 1d ago)    │ │
│ │ [Restore] [Delete Forever]          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Behavior:**
- Grouped by type (People, Shots, Courses, As-Needed)
- Each item shows: name, person, days since deleted
- People show count of related items that will be affected
- Restore = brings item back
- Delete Forever = permanent (with confirm modal)
- Empty All = permanent delete everything in trash

### 7. Navigation Update

Add to Settings page or bottom nav:
- Trash link with badge showing count of items

### 8. Cleanup Cron (pg_cron - pure SQL)

Add to migration script:

```sql
-- Enable pg_cron extension (if not already enabled in Supabase dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function
CREATE OR REPLACE FUNCTION ht_cleanup_trash()
RETURNS void AS $$
BEGIN
  -- Delete items older than 30 days
  DELETE FROM shot_schedules WHERE deleted_at < NOW() - INTERVAL '30 days';
  DELETE FROM medicine_courses WHERE deleted_at < NOW() - INTERVAL '30 days';
  DELETE FROM prn_meds WHERE deleted_at < NOW() - INTERVAL '30 days';
  DELETE FROM people WHERE deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily at 3am UTC
SELECT cron.schedule('cleanup-trash-daily', '0 3 * * *', 'SELECT ht_cleanup_trash()');
```

No edge functions needed - runs entirely in the database.

### 9. Doc Update (`docs/monetization-plan.md`)

Add section noting soft-delete is a core feature (not paid-only).

---

## Files to Modify

| File | Changes |
|------|---------|
| `sql/soft-delete-migration.sql` | NEW - migration script |
| `sql/schema.sql` | Update with deleted_at columns (for reference) |
| `src/types.ts` | Add `deleted_at` to entity types |
| `src/stores/people-store.ts` | Soft delete instead of hard delete |
| `src/stores/shots-store.ts` | Soft delete for schedules |
| `src/stores/medicine-store.ts` | Soft delete for courses |
| `src/stores/prn-store.ts` | Soft delete for meds |
| `src/stores/trash-store.ts` | NEW - trash management |
| `src/pages/Trash.tsx` | NEW - trash UI |
| `src/App.tsx` | Add /trash route |
| `src/pages/Settings.tsx` | Add Trash link |
| `docs/monetization-plan.md` | Document soft-delete feature |

---

## Edge Cases

1. **Delete schedule → delete person → restore person**: Schedule stays in trash (was independently deleted)
2. **Delete person → restore person**: All their items come back (they were just hidden, not deleted)
3. **Caregiver deletes item**: Goes to trash, caregiver or owner can restore
4. **Delete Forever person**: CASCADE deletes all their schedules, courses, meds, logs
