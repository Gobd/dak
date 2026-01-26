-- Tracker App Schema
-- Personal consumption tracking with targets and streaks
-- Run this file to create a fresh schema (drops existing objects first)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- DROP EXISTING OBJECTS (in reverse dependency order)
--------------------------------------------------------------------------------

-- Drop functions first (CASCADE needed for tracker_logged_at_to_date which has dependent index)
DROP FUNCTION IF EXISTS tracker_get_streak_stats(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS tracker_get_daily_totals(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS tracker_calculate_units(INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS tracker_logged_at_to_date(TIMESTAMPTZ) CASCADE;

-- Drop tables (entries/presets before targets due to potential future FKs)
DROP TABLE IF EXISTS tracker_entries CASCADE;
DROP TABLE IF EXISTS tracker_presets CASCADE;
DROP TABLE IF EXISTS tracker_targets CASCADE;

--------------------------------------------------------------------------------
-- TABLES
--------------------------------------------------------------------------------

-- User targets (one active target per user)
CREATE TABLE tracker_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit NUMERIC(4, 2) NOT NULL DEFAULT 14.0, -- units per day
  cost_per_unit NUMERIC(6, 2), -- optional: for cost tracking (e.g., 2.50 = $2.50/unit)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id) -- one target per user
);

-- Consumption entries
CREATE TABLE tracker_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_ml INTEGER NOT NULL,           -- volume in milliliters
  percentage NUMERIC(4, 1) NOT NULL,    -- strength (e.g., 5.0 for 5%)
  units NUMERIC(5, 2) NOT NULL,         -- calculated: (volume_ml * percentage / 100) / 10
  daily_limit NUMERIC(4, 2) NOT NULL,   -- snapshot of target at time of entry (for historical accuracy)
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quick-add presets
CREATE TABLE tracker_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  volume_ml INTEGER NOT NULL,
  percentage NUMERIC(4, 1) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS (must be created before indexes that use them)
--------------------------------------------------------------------------------

-- Immutable date extraction for indexing (TIMESTAMPTZ -> DATE in UTC)
CREATE OR REPLACE FUNCTION tracker_logged_at_to_date(ts TIMESTAMPTZ)
RETURNS DATE AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$ LANGUAGE SQL IMMUTABLE;

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

CREATE INDEX idx_tracker_entries_user_id ON tracker_entries(user_id);
CREATE INDEX idx_tracker_entries_logged_at ON tracker_entries(logged_at DESC);
CREATE INDEX idx_tracker_entries_user_date ON tracker_entries(user_id, tracker_logged_at_to_date(logged_at));
CREATE INDEX idx_tracker_presets_user_id ON tracker_presets(user_id);
CREATE INDEX idx_tracker_presets_sort ON tracker_presets(user_id, sort_order);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--------------------------------------------------------------------------------

ALTER TABLE tracker_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_presets ENABLE ROW LEVEL SECURITY;

-- Targets: users can only access their own
CREATE POLICY "Users can manage own tracker_targets"
  ON tracker_targets FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Entries: users can only access their own
CREATE POLICY "Users can manage own tracker_entries"
  ON tracker_entries FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Presets: users can only access their own
CREATE POLICY "Users can manage own tracker_presets"
  ON tracker_presets FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

--------------------------------------------------------------------------------
-- FUNCTIONS
--------------------------------------------------------------------------------

-- Calculate units from volume and percentage
CREATE OR REPLACE FUNCTION tracker_calculate_units(volume_ml INTEGER, percentage NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND((volume_ml * percentage / 100.0) / 10.0, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get daily totals for a user within a date range
CREATE OR REPLACE FUNCTION tracker_get_daily_totals(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  day DATE,
  total_units NUMERIC,
  entry_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.day::date,
    COALESCE(SUM(e.units), 0)::NUMERIC AS total_units,
    COUNT(e.id)::INTEGER AS entry_count
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d(day)
  LEFT JOIN tracker_entries e ON tracker_logged_at_to_date(e.logged_at) = d.day::date
    AND e.user_id = p_user_id
  GROUP BY d.day
  ORDER BY d.day DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get streak stats for a user
-- Tracks: zero days, under-target days, and over-target days
-- Only counts from user's first entry date (not arbitrary 365 days back)
-- Uses stored daily_limit from entries for historical accuracy
CREATE OR REPLACE FUNCTION tracker_get_streak_stats(p_user_id UUID, p_daily_limit NUMERIC)
RETURNS TABLE (
  current_under_streak INTEGER,
  current_zero_streak INTEGER,
  longest_under_streak INTEGER,
  longest_zero_streak INTEGER,
  current_over_streak INTEGER,
  total_zero_days INTEGER,
  total_under_days INTEGER,
  days_tracked INTEGER
) AS $$
DECLARE
  v_current_under INTEGER := 0;
  v_current_zero INTEGER := 0;
  v_longest_under INTEGER := 0;
  v_longest_zero INTEGER := 0;
  v_current_over INTEGER := 0;
  v_temp_under INTEGER := 0;
  v_temp_zero INTEGER := 0;
  v_total_zero INTEGER := 0;
  v_total_under INTEGER := 0;
  v_days_tracked INTEGER := 0;
  v_first_entry_date DATE;
  v_day_limit NUMERIC;
  r RECORD;
BEGIN
  -- Find the user's first entry date
  SELECT MIN(tracker_logged_at_to_date(logged_at)) INTO v_first_entry_date
  FROM tracker_entries
  WHERE user_id = p_user_id;

  -- If no entries, return zeros
  IF v_first_entry_date IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Iterate through days from first entry to today
  FOR r IN
    SELECT
      d.day::date,
      COALESCE(SUM(e.units), 0) AS total_units,
      MAX(e.daily_limit) AS day_limit
    FROM generate_series(
      v_first_entry_date,
      CURRENT_DATE,
      '1 day'::interval
    ) AS d(day)
    LEFT JOIN tracker_entries e ON tracker_logged_at_to_date(e.logged_at) = d.day::date
      AND e.user_id = p_user_id
    GROUP BY d.day
    ORDER BY d.day ASC
  LOOP
    v_days_tracked := v_days_tracked + 1;
    v_day_limit := r.day_limit;

    -- Zero day tracking
    IF r.total_units = 0 THEN
      v_temp_zero := v_temp_zero + 1;
      v_total_zero := v_total_zero + 1;
      IF v_temp_zero > v_longest_zero THEN
        v_longest_zero := v_temp_zero;
      END IF;
    ELSE
      v_temp_zero := 0;
    END IF;

    -- Under target tracking (includes zero days)
    IF r.total_units <= v_day_limit THEN
      v_temp_under := v_temp_under + 1;
      v_total_under := v_total_under + 1;
      v_current_over := 0; -- Reset over streak
      IF v_temp_under > v_longest_under THEN
        v_longest_under := v_temp_under;
      END IF;
    ELSE
      v_temp_under := 0;
      v_current_over := v_current_over + 1;
    END IF;
  END LOOP;

  v_current_under := v_temp_under;
  v_current_zero := v_temp_zero;

  RETURN QUERY SELECT
    v_current_under,
    v_current_zero,
    v_longest_under,
    v_longest_zero,
    v_current_over,
    v_total_zero,
    v_total_under,
    v_days_tracked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- COMMENTS (documentation)
--------------------------------------------------------------------------------

COMMENT ON TABLE tracker_targets IS 'User daily consumption targets and settings';
COMMENT ON TABLE tracker_entries IS 'Individual consumption log entries';
COMMENT ON TABLE tracker_presets IS 'Quick-add templates for common servings';

COMMENT ON COLUMN tracker_targets.daily_limit IS 'Daily unit limit (1 unit = 10ml ethanol)';
COMMENT ON COLUMN tracker_targets.cost_per_unit IS 'Optional cost per unit for expense tracking';

COMMENT ON COLUMN tracker_entries.volume_ml IS 'Volume consumed in milliliters';
COMMENT ON COLUMN tracker_entries.percentage IS 'Strength percentage';
COMMENT ON COLUMN tracker_entries.units IS 'Calculated units: (volume_ml * percentage / 100) / 10';

COMMENT ON FUNCTION tracker_logged_at_to_date IS 'Immutable UTC date extraction for indexing';
COMMENT ON FUNCTION tracker_calculate_units IS 'Calculate units from volume (ml) and strength percentage';
COMMENT ON FUNCTION tracker_get_daily_totals IS 'Get daily consumption totals for a date range';
COMMENT ON FUNCTION tracker_get_streak_stats IS 'Get streak statistics including zero days, under-target days, and totals';
