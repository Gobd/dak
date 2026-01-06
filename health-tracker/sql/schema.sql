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
