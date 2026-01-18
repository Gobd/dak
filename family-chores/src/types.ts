export interface FamilyMember {
  id: string;
  name: string;
  avatar_emoji: string;
  color: string;
  created_at: string;
}

export interface Chore {
  id: string;
  name: string;
  description: string | null;
  points: number;
  schedule_type: 'daily' | 'every_x_days' | 'weekly' | 'monthly' | 'as_needed' | 'goal';
  interval_days: number | null;
  weekly_days: number[] | null;
  monthly_day: number | null;
  assignment_type: 'anyone' | 'everyone';
  times_per_day: number; // For multi-daily tasks (default 1)
  // Goal/habit fields (used when schedule_type = 'goal')
  target_count: number | null; // Target completions per period
  goal_period: 'daily' | 'weekly' | 'monthly' | null;
  is_active: boolean;
  created_at: string;
}

export interface ChoreAssignment {
  id: string;
  chore_id: string;
  member_id: string;
  created_at: string;
}

export interface ChoreWithAssignments extends Chore {
  assignments: Array<{
    id: string;
    member: FamilyMember;
  }>;
}

export interface ChoreInstance {
  id: string;
  chore_id: string;
  assigned_to: string | null; // null for "anyone" type, member_id for "everyone" type
  completed_by: string | null;
  scheduled_date: string;
  completed: boolean;
  completed_at: string | null;
  points_awarded: number | null;
  occurrence_number: number; // For multi-daily (1, 2, 3...)
  created_at: string;
}

export interface ChoreInstanceWithDetails extends ChoreInstance {
  chore: Chore;
  assigned_member: FamilyMember | null; // null for "anyone" type
  completed_by_member: FamilyMember | null;
  assignees: FamilyMember[]; // All possible assignees for this chore
}

export interface PointsLedgerEntry {
  id: string;
  member_id: string;
  amount: number;
  transaction_type: 'earned' | 'redeemed' | 'adjustment';
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  member?: FamilyMember;
}

export interface AppSettings {
  id: string;
  parent_pin: string | null;
  hide_points: boolean; // Hide all points UI
  created_at: string;
}

// Goal/habit completions
export interface GoalCompletion {
  id: string;
  chore_id: string;
  member_id: string;
  period_start: string;
  completed_at: string;
  points_awarded: number | null;
  created_at: string;
}

// Goal progress for UI display
export interface GoalProgress {
  chore: Chore;
  member: FamilyMember;
  target_count: number;
  completions_this_period: number;
  period_start: string;
  is_complete: boolean; // completions >= target
}

export type DashboardView = 'today' | 'my-tasks' | 'weekly' | 'leaderboard';

export type SyncEvent =
  | { type: 'members' }
  | { type: 'chores' }
  | { type: 'instances' }
  | { type: 'points' }
  | { type: 'goals' }
  | { type: 'settings' };
