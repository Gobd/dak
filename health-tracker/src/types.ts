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

// User Profile Types
export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDisplayInfo {
  user_id: string;
  display_name: string;
  email: string;
}

// Family Sharing Types
export type SharingPermission = "co-owner" | "caregiver";

export interface SharingInvite {
  id: string;
  owner_id: string;
  invitee_id: string;
  person_ids: string[];
  permission: SharingPermission;
  status: "pending" | "accepted" | "denied";
  created_at: string;
  responded_at: string | null;
  // Joined data
  owner_name?: string;
  owner_email?: string;
  invitee_name?: string;
  invitee_email?: string;
  people?: Pick<Person, "id" | "name">[];
}

export interface SharingAccess {
  id: string;
  owner_id: string;
  member_id: string;
  person_id: string;
  permission: SharingPermission;
  created_at: string;
  // Joined data
  person?: Person;
}

export interface SharingBlacklist {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
  // Joined data
  blocked_name?: string;
  blocked_email?: string;
}

export interface SharingMember {
  member_id: string;
  member_name: string;
  member_email: string;
  permission: SharingPermission;
  people: Person[];
}

export interface SharedOwner {
  owner_id: string;
  owner_name: string;
  owner_email: string;
  permission: SharingPermission;
  people: Person[];
}
