# Plan: Multi-Daily Chores + Habits/Goals

## Summary

Two features extending the chores system:

1. **Multi-daily chores**: Tasks done multiple times per day (e.g., brush teeth 2x)
2. **Habits/Goals**: Counter-based targets over a period (e.g., gym 3x/week)

---

## Feature 1: Multi-Daily Chores

**Behavior**: Generate N separate checkbox instances per day.

### Schema Changes

```sql
-- Add to chores table
ALTER TABLE chores ADD COLUMN times_per_day INT NOT NULL DEFAULT 1;

-- Add to chore_instances table
ALTER TABLE chore_instances ADD COLUMN occurrence_number INT NOT NULL DEFAULT 1;

-- Update unique index to include occurrence
DROP INDEX idx_chore_instances_unique;
CREATE UNIQUE INDEX idx_chore_instances_unique ON chore_instances(
  chore_id,
  COALESCE(assigned_to, '00000000-0000-0000-0000-000000000000'::UUID),
  scheduled_date,
  occurrence_number
);
```

### Files to Modify

- `sql/schema.sql` - Add columns and update index
- `src/types.ts` - Add `times_per_day` to Chore, `occurrence_number` to ChoreInstance
- `src/stores/instances-store.ts` - Loop `times_per_day` times in `ensureTodayInstances()`
- `src/components/shared/TaskCard.tsx` - Show "(1 of 2)" label when `times_per_day > 1`
- `src/components/modals/ChoreEditModal.tsx` - Add times_per_day input (only for daily schedule)

---

## Feature 2: Habits/Goals

**Behavior**: Counter-based progress toward a target. Always per-person, no race mode. Allow over-achievement.

### Schema Changes

```sql
-- Add to chores table (reuse chores table with new schedule type)
ALTER TABLE chores
  ADD COLUMN target_count INT,
  ADD COLUMN goal_period TEXT CHECK (goal_period IN ('daily', 'weekly', 'monthly'));

-- Update schedule_type check
ALTER TABLE chores DROP CONSTRAINT chores_schedule_type_check;
ALTER TABLE chores ADD CONSTRAINT chores_schedule_type_check
  CHECK (schedule_type IN ('daily', 'every_x_days', 'weekly', 'monthly', 'as_needed', 'goal'));

-- New table for tracking goal completions (tap to increment)
CREATE TABLE goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_awarded INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goal_completions_chore ON goal_completions(chore_id);
CREATE INDEX idx_goal_completions_member ON goal_completions(member_id);
CREATE INDEX idx_goal_completions_period ON goal_completions(period_start);

ALTER TABLE goal_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goal_completions"
  ON goal_completions FOR ALL TO authenticated
  USING (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()))
  WITH CHECK (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()));
```

### Files to Modify

- `sql/schema.sql` - Add columns, new table, RLS
- `src/types.ts` - Add new fields to Chore, new `GoalCompletion` and `GoalProgress` types
- `src/stores/goals-store.ts` - **NEW** store for goal progress and completions
- `src/components/shared/GoalCard.tsx` - **NEW** component with progress dots and increment button
- `src/components/views/TodayView.tsx` - Add sections: DAILY GOALS, THIS WEEK, THIS MONTH
- `src/components/modals/ChoreEditModal.tsx` - Add goal mode (target_count, goal_period, per-person assignment)
- `src/Dashboard.tsx` - Initialize goals store, handle sync events

---

## UI Layout

```
TODAY
[ ] Make bed (Alice)
[ ] Brush teeth (1 of 2) (Bob)
[ ] Brush teeth (2 of 2) (Bob)

DAILY GOALS
[●●●●○] Water 5x (Bob) - 4/5

THIS WEEK
[●●●✓] Gym 3x (Alice) - 3/3 ✓
[●●○○○] Run 5x (Bob) - 2/5

THIS MONTH
[●●○○○○○○] Read 8 books (Alice) - 2/8
```

### GoalCard Behavior

- Tap card or + button to increment completion count
- Shows progress dots: `●●○○○`
- Shows fraction: `2/5`
- When target met: green checkmark, but still tappable for over-achievement
- Over-achievement: `4/3` shows as `●●●● (4/3)`

---

## Implementation Order

### Phase 1: Multi-Daily Chores

1. Run schema migration (add columns, update index)
2. Update `types.ts`
3. Update `instances-store.ts` - modify `ensureTodayInstances()` loop
4. Update `TaskCard.tsx` - show occurrence label
5. Update `ChoreEditModal.tsx` - add times_per_day control
6. Test: Create "Brush teeth" 2x/day, verify 2 separate checkboxes

### Phase 2: Goals/Habits

1. Run schema migration (add columns, new table)
2. Update `types.ts` with goal types
3. Create `goals-store.ts`
4. Create `GoalCard.tsx` component
5. Update `TodayView.tsx` - add period sections
6. Update `ChoreEditModal.tsx` - add goal mode
7. Update `Dashboard.tsx` - init store, sync
8. Test: Create "Gym 3x/week", verify counter and progress

---

## Key Files

| File                                       | Changes                                     |
| ------------------------------------------ | ------------------------------------------- |
| `sql/schema.sql`                           | Add columns, new table, updated constraints |
| `src/types.ts`                             | New fields and types                        |
| `src/stores/instances-store.ts`            | Multi-daily instance generation             |
| `src/stores/goals-store.ts`                | **NEW** - goal progress and completions     |
| `src/components/shared/TaskCard.tsx`       | Occurrence label display                    |
| `src/components/shared/GoalCard.tsx`       | **NEW** - progress dots, increment          |
| `src/components/views/TodayView.tsx`       | Period-based sections                       |
| `src/components/modals/ChoreEditModal.tsx` | Goal mode UI                                |
| `src/Dashboard.tsx`                        | Store init, sync handling                   |
