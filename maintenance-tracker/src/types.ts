export type ScheduleType = 'rolling' | 'fixed';

export interface MaintenanceTask {
  id: string;
  name: string;
  interval_value: number;
  interval_unit: 'days' | 'weeks' | 'months';
  schedule_type: ScheduleType;
  last_done: string | null;
  next_due: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  task_id: string;
  completed_at: string;
  notes: string | null;
  created_at: string;
}

export type SyncEvent = { type: 'tasks' } | { type: 'logs' };
