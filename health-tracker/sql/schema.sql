-- Health Tracker Schema
-- Run this in Supabase SQL Editor

-- People being tracked (you, spouse, kids)
-- user_id ties all data to the authenticated user
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shot schedules (recurring injections)
CREATE TABLE shot_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  interval_days INT DEFAULT 7,
  current_dose TEXT,
  next_due DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shot log entries
CREATE TABLE shot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES shot_schedules(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL,
  dose TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine courses (antibiotics, etc.)
CREATE TABLE medicine_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  duration_days INT NOT NULL,
  doses_per_day INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine dose checkboxes
CREATE TABLE medicine_doses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES medicine_courses(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  dose_number INT NOT NULL,
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMPTZ,
  UNIQUE(course_id, scheduled_date, dose_number)
);

-- As-needed (PRN) medications (ibuprofen, tylenol, etc.)
CREATE TABLE prn_meds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_hours INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRN medication log (when given)
CREATE TABLE prn_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  med_id UUID REFERENCES prn_meds(id) ON DELETE CASCADE,
  given_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_people_user ON people(user_id);
CREATE INDEX idx_shot_schedules_person ON shot_schedules(person_id);
CREATE INDEX idx_shot_logs_schedule ON shot_logs(schedule_id);
CREATE INDEX idx_medicine_courses_person ON medicine_courses(person_id);
CREATE INDEX idx_medicine_doses_course ON medicine_doses(course_id);
CREATE INDEX idx_prn_meds_person ON prn_meds(person_id);
CREATE INDEX idx_prn_logs_med ON prn_logs(med_id);

-- ============================================
-- ROW LEVEL SECURITY
-- Data only accessible to the user who owns it
-- ============================================

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_doses ENABLE ROW LEVEL SECURITY;
ALTER TABLE prn_meds ENABLE ROW LEVEL SECURITY;
ALTER TABLE prn_logs ENABLE ROW LEVEL SECURITY;

-- People: only own records
CREATE POLICY "Users can manage own people"
  ON people FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Shot schedules: via people ownership
CREATE POLICY "Users can manage own shot_schedules"
  ON shot_schedules FOR ALL
  TO authenticated
  USING (person_id IN (SELECT id FROM people WHERE user_id = auth.uid()))
  WITH CHECK (person_id IN (SELECT id FROM people WHERE user_id = auth.uid()));

-- Shot logs: via schedule -> people ownership
CREATE POLICY "Users can manage own shot_logs"
  ON shot_logs FOR ALL
  TO authenticated
  USING (schedule_id IN (
    SELECT ss.id FROM shot_schedules ss
    JOIN people p ON ss.person_id = p.id
    WHERE p.user_id = auth.uid()
  ))
  WITH CHECK (schedule_id IN (
    SELECT ss.id FROM shot_schedules ss
    JOIN people p ON ss.person_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- Medicine courses: via people ownership
CREATE POLICY "Users can manage own medicine_courses"
  ON medicine_courses FOR ALL
  TO authenticated
  USING (person_id IN (SELECT id FROM people WHERE user_id = auth.uid()))
  WITH CHECK (person_id IN (SELECT id FROM people WHERE user_id = auth.uid()));

-- Medicine doses: via course -> people ownership
CREATE POLICY "Users can manage own medicine_doses"
  ON medicine_doses FOR ALL
  TO authenticated
  USING (course_id IN (
    SELECT mc.id FROM medicine_courses mc
    JOIN people p ON mc.person_id = p.id
    WHERE p.user_id = auth.uid()
  ))
  WITH CHECK (course_id IN (
    SELECT mc.id FROM medicine_courses mc
    JOIN people p ON mc.person_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- PRN meds: via people ownership
CREATE POLICY "Users can manage own prn_meds"
  ON prn_meds FOR ALL
  TO authenticated
  USING (person_id IN (SELECT id FROM people WHERE user_id = auth.uid()))
  WITH CHECK (person_id IN (SELECT id FROM people WHERE user_id = auth.uid()));

-- PRN logs: via med -> people ownership
CREATE POLICY "Users can manage own prn_logs"
  ON prn_logs FOR ALL
  TO authenticated
  USING (med_id IN (
    SELECT pm.id FROM prn_meds pm
    JOIN people p ON pm.person_id = p.id
    WHERE p.user_id = auth.uid()
  ))
  WITH CHECK (med_id IN (
    SELECT pm.id FROM prn_meds pm
    JOIN people p ON pm.person_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- ============================================
-- FAMILY SHARING
-- Allow users to share access to specific people
-- with other users (co-owner or caregiver roles)
-- ============================================

-- Lookup user by email (needed for invites)
CREATE OR REPLACE FUNCTION ht_lookup_user_by_email(lookup_email TEXT)
RETURNS TABLE(user_id UUID, email TEXT) AS $$
  SELECT id, email::TEXT FROM auth.users WHERE email = lookup_email;
$$ LANGUAGE SQL SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ht_lookup_user_by_email TO authenticated;

-- Helper: Returns person IDs the current user can access (own + shared)
CREATE OR REPLACE FUNCTION ht_accessible_person_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM people WHERE user_id = auth.uid()
  UNION
  SELECT person_id FROM ht_sharing_access WHERE member_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: Returns person IDs user can write to (own OR co-owner access)
CREATE OR REPLACE FUNCTION ht_writable_person_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM people WHERE user_id = auth.uid()
  UNION
  SELECT person_id FROM ht_sharing_access
  WHERE member_id = auth.uid() AND permission = 'co-owner';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Pending/processed invitations
CREATE TABLE ht_sharing_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  person_ids UUID[] NOT NULL,
  permission TEXT NOT NULL DEFAULT 'caregiver' CHECK (permission IN ('co-owner', 'caregiver')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Active access grants (created when invite accepted)
CREATE TABLE ht_sharing_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  member_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'caregiver' CHECK (permission IN ('co-owner', 'caregiver')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, member_id, person_id)
);

-- Blacklist for denied inviters (prevents future invite notifications)
CREATE TABLE ht_sharing_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  blocked_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, blocked_user_id)
);

-- Indexes for sharing tables
CREATE INDEX idx_ht_sharing_invites_owner ON ht_sharing_invites(owner_id);
CREATE INDEX idx_ht_sharing_invites_invitee ON ht_sharing_invites(invitee_id, status);
CREATE INDEX idx_ht_sharing_access_owner ON ht_sharing_access(owner_id);
CREATE INDEX idx_ht_sharing_access_member ON ht_sharing_access(member_id);
CREATE INDEX idx_ht_sharing_access_person ON ht_sharing_access(person_id);
CREATE INDEX idx_ht_sharing_blacklist_user ON ht_sharing_blacklist(user_id);

-- Enable RLS on sharing tables
ALTER TABLE ht_sharing_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ht_sharing_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE ht_sharing_blacklist ENABLE ROW LEVEL SECURITY;

-- RLS for ht_sharing_invites
CREATE POLICY "View own invites"
  ON ht_sharing_invites FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Owner creates invites"
  ON ht_sharing_invites FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner cancels pending invites"
  ON ht_sharing_invites FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND status = 'pending');

CREATE POLICY "Invitee responds to invites"
  ON ht_sharing_invites FOR UPDATE
  TO authenticated
  USING (invitee_id = auth.uid() AND status = 'pending');

-- RLS for ht_sharing_access
CREATE POLICY "View own access"
  ON ht_sharing_access FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR member_id = auth.uid());

CREATE POLICY "Owner grants access"
  ON ht_sharing_access FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner or member can delete access"
  ON ht_sharing_access FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR member_id = auth.uid());

CREATE POLICY "Owner updates access"
  ON ht_sharing_access FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS for ht_sharing_blacklist
CREATE POLICY "Manage own blacklist"
  ON ht_sharing_blacklist FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- UPDATED RLS POLICIES FOR SHARING SUPPORT
-- Run this section to enable sharing on existing tables
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can manage own people" ON people;
DROP POLICY IF EXISTS "Users can manage own shot_schedules" ON shot_schedules;
DROP POLICY IF EXISTS "Users can manage own shot_logs" ON shot_logs;
DROP POLICY IF EXISTS "Users can manage own medicine_courses" ON medicine_courses;
DROP POLICY IF EXISTS "Users can manage own medicine_doses" ON medicine_doses;
DROP POLICY IF EXISTS "Users can manage own prn_meds" ON prn_meds;
DROP POLICY IF EXISTS "Users can manage own prn_logs" ON prn_logs;

-- People: owner manages, shared users can view
CREATE POLICY "View own and shared people"
  ON people FOR SELECT
  TO authenticated
  USING (id IN (SELECT ht_accessible_person_ids()));

CREATE POLICY "Owner adds people"
  ON people FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner updates people"
  ON people FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner deletes people"
  ON people FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Shot schedules: co-owners can add/edit, caregivers read-only
CREATE POLICY "View accessible shot_schedules"
  ON shot_schedules FOR SELECT
  TO authenticated
  USING (person_id IN (SELECT ht_accessible_person_ids()));

CREATE POLICY "Write shot_schedules"
  ON shot_schedules FOR INSERT
  TO authenticated
  WITH CHECK (person_id IN (SELECT ht_writable_person_ids()));

CREATE POLICY "Update shot_schedules"
  ON shot_schedules FOR UPDATE
  TO authenticated
  USING (person_id IN (SELECT ht_writable_person_ids()));

CREATE POLICY "Delete shot_schedules"
  ON shot_schedules FOR DELETE
  TO authenticated
  USING (person_id IN (SELECT ht_writable_person_ids()));

-- Shot logs: everyone with access can log (caregivers need this)
CREATE POLICY "Manage shot_logs"
  ON shot_logs FOR ALL
  TO authenticated
  USING (schedule_id IN (
    SELECT id FROM shot_schedules WHERE person_id IN (SELECT ht_accessible_person_ids())
  ))
  WITH CHECK (schedule_id IN (
    SELECT id FROM shot_schedules WHERE person_id IN (SELECT ht_accessible_person_ids())
  ));

-- Medicine courses: co-owners can add/edit, caregivers read-only
CREATE POLICY "View accessible medicine_courses"
  ON medicine_courses FOR SELECT
  TO authenticated
  USING (person_id IN (SELECT ht_accessible_person_ids()));

CREATE POLICY "Write medicine_courses"
  ON medicine_courses FOR INSERT
  TO authenticated
  WITH CHECK (person_id IN (SELECT ht_writable_person_ids()));

CREATE POLICY "Update medicine_courses"
  ON medicine_courses FOR UPDATE
  TO authenticated
  USING (person_id IN (SELECT ht_writable_person_ids()));

CREATE POLICY "Delete medicine_courses"
  ON medicine_courses FOR DELETE
  TO authenticated
  USING (person_id IN (SELECT ht_writable_person_ids()));

-- Medicine doses: everyone with access can mark taken (caregivers need this)
CREATE POLICY "Manage medicine_doses"
  ON medicine_doses FOR ALL
  TO authenticated
  USING (course_id IN (
    SELECT id FROM medicine_courses WHERE person_id IN (SELECT ht_accessible_person_ids())
  ))
  WITH CHECK (course_id IN (
    SELECT id FROM medicine_courses WHERE person_id IN (SELECT ht_accessible_person_ids())
  ));

-- PRN meds: co-owners can add/edit, caregivers read-only
CREATE POLICY "View accessible prn_meds"
  ON prn_meds FOR SELECT
  TO authenticated
  USING (person_id IN (SELECT ht_accessible_person_ids()));

CREATE POLICY "Write prn_meds"
  ON prn_meds FOR INSERT
  TO authenticated
  WITH CHECK (person_id IN (SELECT ht_writable_person_ids()));

CREATE POLICY "Update prn_meds"
  ON prn_meds FOR UPDATE
  TO authenticated
  USING (person_id IN (SELECT ht_writable_person_ids()));

CREATE POLICY "Delete prn_meds"
  ON prn_meds FOR DELETE
  TO authenticated
  USING (person_id IN (SELECT ht_writable_person_ids()));

-- PRN logs: everyone with access can log
CREATE POLICY "Manage prn_logs"
  ON prn_logs FOR ALL
  TO authenticated
  USING (med_id IN (
    SELECT id FROM prn_meds WHERE person_id IN (SELECT ht_accessible_person_ids())
  ))
  WITH CHECK (med_id IN (
    SELECT id FROM prn_meds WHERE person_id IN (SELECT ht_accessible_person_ids())
  ));

-- ============================================
-- USER PROFILES
-- Store display names and other user settings
-- ============================================

CREATE TABLE ht_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ht_user_profiles_user ON ht_user_profiles(user_id);

ALTER TABLE ht_user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view any profile (needed for showing names in sharing UI)
CREATE POLICY "View all profiles"
  ON ht_user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only manage their own profile
CREATE POLICY "Manage own profile"
  ON ht_user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own profile"
  ON ht_user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to get user display info by user_id
-- Returns display_name if set, otherwise email
CREATE OR REPLACE FUNCTION ht_get_user_display_info(lookup_user_id UUID)
RETURNS TABLE(user_id UUID, display_name TEXT, email TEXT) AS $$
  SELECT
    au.id as user_id,
    COALESCE(p.display_name, split_part(au.email::TEXT, '@', 1)) as display_name,
    au.email::TEXT as email
  FROM auth.users au
  LEFT JOIN ht_user_profiles p ON p.user_id = au.id
  WHERE au.id = lookup_user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ht_get_user_display_info TO authenticated;

-- Function to get multiple users' display info at once
CREATE OR REPLACE FUNCTION ht_get_users_display_info(user_ids UUID[])
RETURNS TABLE(user_id UUID, display_name TEXT, email TEXT) AS $$
  SELECT
    au.id as user_id,
    COALESCE(p.display_name, split_part(au.email::TEXT, '@', 1)) as display_name,
    au.email::TEXT as email
  FROM auth.users au
  LEFT JOIN ht_user_profiles p ON p.user_id = au.id
  WHERE au.id = ANY(user_ids);
$$ LANGUAGE SQL SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ht_get_users_display_info TO authenticated;
