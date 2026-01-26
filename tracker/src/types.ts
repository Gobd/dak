export interface Target {
  id: string;
  user_id: string;
  daily_limit: number; // units per day
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  volume_ml: number;
  percentage: number; // strength (e.g., 5.0 for 5%)
  units: number; // calculated: (volume_ml * percentage / 100) / 10
  daily_limit: number | null; // snapshot of target at time of entry
  logged_at: string;
  notes: string | null;
  created_at: string;
}

export interface Preset {
  id: string;
  user_id: string;
  name: string;
  volume_ml: number;
  percentage: number;
  sort_order: number;
  created_at: string;
}

export interface DailyTotal {
  day: string; // date string YYYY-MM-DD
  total_units: number;
  entry_count: number;
}

export interface StreakStats {
  current_under_streak: number;
  current_zero_streak: number;
  longest_under_streak: number;
  longest_zero_streak: number;
  current_over_streak: number;
  total_zero_days: number;
  total_under_days: number;
  days_tracked: number;
}

// Default presets to seed for new users
export const DEFAULT_PRESETS: Omit<Preset, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Pint', volume_ml: 568, percentage: 5.0, sort_order: 0 },
  { name: 'Half pint', volume_ml: 284, percentage: 5.0, sort_order: 1 },
  { name: 'Small glass', volume_ml: 175, percentage: 13.0, sort_order: 2 },
  { name: 'Large glass', volume_ml: 250, percentage: 13.0, sort_order: 3 },
  { name: 'Shot', volume_ml: 25, percentage: 40.0, sort_order: 4 },
  { name: 'Can/bottle', volume_ml: 330, percentage: 5.0, sort_order: 5 },
  { name: '12oz can', volume_ml: 355, percentage: 5.0, sort_order: 6 },
  { name: '16oz can', volume_ml: 473, percentage: 5.0, sort_order: 7 },
];
