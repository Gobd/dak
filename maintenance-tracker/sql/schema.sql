-- Maintenance Tracker Schema
-- Run this in Supabase SQL Editor (same project as health-tracker)
-- All tables prefixed with maint_ to avoid conflicts

-- Maintenance tasks (recurring home/car maintenance items)
CREATE TABLE maint_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  interval_value INT NOT NULL DEFAULT 30,
  interval_unit TEXT NOT NULL DEFAULT 'days', -- days, weeks, months
  last_done DATE,
  next_due DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance log (history of completions)
CREATE TABLE maint_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  task_id UUID REFERENCES maint_tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_maint_tasks_user ON maint_tasks(user_id);
CREATE INDEX idx_maint_tasks_next_due ON maint_tasks(next_due);
CREATE INDEX idx_maint_logs_user ON maint_logs(user_id);
CREATE INDEX idx_maint_logs_task ON maint_logs(task_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE maint_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maint_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own maint_tasks"
  ON maint_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage own maint_logs"
  ON maint_logs FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
