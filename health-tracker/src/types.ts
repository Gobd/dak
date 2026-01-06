export interface Person {
  id: string;
  name: string;
  created_at: string;
}

export interface ShotSchedule {
  id: string;
  person_id: string;
  name: string;
  interval_days: number;
  current_dose: string;
  next_due: string;
  created_at: string;
  person?: Person;
}

export interface ShotLog {
  id: string;
  schedule_id: string;
  taken_at: string;
  dose: string;
  notes: string | null;
  created_at: string;
}

export interface MedicineCourse {
  id: string;
  person_id: string;
  name: string;
  start_date: string;
  duration_days: number;
  doses_per_day: number;
  notes: string | null;
  created_at: string;
  person?: Person;
}

export interface MedicineDose {
  id: string;
  course_id: string;
  scheduled_date: string;
  dose_number: number;
  taken: boolean;
  taken_at: string | null;
}

export interface PrnMed {
  id: string;
  person_id: string;
  name: string;
  min_hours: number;
  created_at: string;
  person?: Person;
}

export interface PrnLog {
  id: string;
  med_id: string;
  given_at: string;
  created_at: string;
}
