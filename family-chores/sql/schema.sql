-- Family Chores Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- DROP EXISTING TABLES (safe to re-run)
-- Order matters due to foreign key constraints
-- ============================================
DROP TABLE IF EXISTS goal_completions CASCADE;
DROP TABLE IF EXISTS points_ledger CASCADE;
DROP TABLE IF EXISTS chore_instances CASCADE;
DROP TABLE IF EXISTS chore_assignments CASCADE;
DROP TABLE IF EXISTS chores CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- ============================================
-- TABLES
-- ============================================

-- Family members (kids, parents, etc.)
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '👤',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chore/routine definitions
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  points INT NOT NULL DEFAULT 1,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'every_x_days', 'weekly', 'monthly', 'as_needed', 'goal')),
  interval_days INT,          -- for every_x_days: interval
  weekly_days INT[],          -- for weekly: [0,1,2...] (0=Sun)
  monthly_day INT,            -- for monthly: 1-31 or -1 for last day
  assignment_type TEXT NOT NULL DEFAULT 'everyone' CHECK (assignment_type IN ('anyone', 'everyone')),
  -- 'anyone': One instance per day, first to complete gets points (race)
  -- 'everyone': One instance per assignee per day, all must complete
  times_per_day INT NOT NULL DEFAULT 1,  -- for multi-daily tasks (e.g., brush teeth 2x)
  -- Goal/habit fields (used when schedule_type = 'goal')
  target_count INT,           -- target completions per period (e.g., 3 for "gym 3x/week")
  goal_period TEXT CHECK (goal_period IN ('daily', 'weekly', 'monthly')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chore assignments (many-to-many)
CREATE TABLE chore_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chore_id, member_id)
);

-- Daily chore instances (generated on-demand)
-- For "anyone" type: one instance per chore per day (assigned_to = NULL)
-- For "everyone" type: one instance per assignee per day
CREATE TABLE chore_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES family_members(id) ON DELETE CASCADE,  -- NULL for "anyone" type
  completed_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  points_awarded INT,
  occurrence_number INT NOT NULL DEFAULT 1,  -- Which occurrence for multi-daily (1, 2, 3...)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for chore instances:
-- Uses COALESCE to handle NULL assigned_to (for "anyone" type chores)
-- Includes occurrence_number for multi-daily support
CREATE UNIQUE INDEX idx_chore_instances_unique
  ON chore_instances(chore_id, COALESCE(assigned_to, '00000000-0000-0000-0000-000000000000'::UUID), scheduled_date, occurrence_number);

-- Goal/habit completions (for schedule_type = 'goal')
-- Each tap increments the count toward target
CREATE TABLE goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,  -- Start of the period (week/month) this completion belongs to
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_awarded INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points ledger (all transactions)
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  amount INT NOT NULL,  -- positive = earned, negative = redeemed
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'adjustment')),
  reference_id UUID,    -- chore_instance_id if earned
  notes TEXT,           -- "30 min screen time" if redeemed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App settings (PIN, preferences)
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() UNIQUE,
  parent_pin TEXT,      -- 4-6 digit PIN for protected actions
  hide_points BOOLEAN DEFAULT FALSE,  -- Hide all points UI (leaderboard, pts badges, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_family_members_user ON family_members(user_id);
CREATE INDEX idx_chores_user ON chores(user_id);
CREATE INDEX idx_chore_assignments_chore ON chore_assignments(chore_id);
CREATE INDEX idx_chore_assignments_member ON chore_assignments(member_id);
CREATE INDEX idx_chore_instances_chore ON chore_instances(chore_id);
CREATE INDEX idx_chore_instances_assigned ON chore_instances(assigned_to);
CREATE INDEX idx_chore_instances_date ON chore_instances(scheduled_date);
CREATE INDEX idx_goal_completions_chore ON goal_completions(chore_id);
CREATE INDEX idx_goal_completions_member ON goal_completions(member_id);
CREATE INDEX idx_goal_completions_period ON goal_completions(period_start);
CREATE INDEX idx_points_ledger_member ON points_ledger(member_id);
CREATE INDEX idx_points_ledger_created ON points_ledger(created_at DESC);
CREATE INDEX idx_app_settings_user ON app_settings(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Family members: only own records
CREATE POLICY "Users can manage own family_members"
  ON family_members FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Chores: only own records
CREATE POLICY "Users can manage own chores"
  ON chores FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Chore assignments: via chore ownership
CREATE POLICY "Users can manage own chore_assignments"
  ON chore_assignments FOR ALL
  TO authenticated
  USING (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()))
  WITH CHECK (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()));

-- Chore instances: via chore ownership
CREATE POLICY "Users can manage own chore_instances"
  ON chore_instances FOR ALL
  TO authenticated
  USING (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()))
  WITH CHECK (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()));

-- Goal completions: via chore ownership
CREATE POLICY "Users can manage own goal_completions"
  ON goal_completions FOR ALL
  TO authenticated
  USING (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()))
  WITH CHECK (chore_id IN (SELECT id FROM chores WHERE user_id = auth.uid()));

-- Points ledger: via family_members ownership
CREATE POLICY "Users can manage own points_ledger"
  ON points_ledger FOR ALL
  TO authenticated
  USING (member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid()));

-- App settings: only own records
CREATE POLICY "Users can manage own app_settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
