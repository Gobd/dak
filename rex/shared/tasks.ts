export type TaskSchedule =
  | { kind: 'once'; at: string }
  | { kind: 'interval'; minutes: number }
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekly'; time: string; timezone: string; days: number[] };
export interface TaskHarness {
  id: string;
  label: string;
  cwd: string;
  command: string[];
}
export interface TaskInput {
  label: string;
  prompt: string;
  harness: string;
  cwd: string;
  schedule: TaskSchedule;
  wrapperFlags?: string[];
  notifyTopic?: string;
}
export interface ScheduledTask extends TaskInput {
  id: string;
  enabled: boolean;
  nextRun: string | null;
  createdAt: string;
}
export interface TaskRun {
  id: string;
  taskId: string;
  label: string;
  harness: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'succeeded' | 'failed';
  output: string;
  error?: string;
  notifyTopic?: string;
  notification?: 'pending' | 'sent' | 'failed';
  notificationError?: string;
}
export interface TaskListing {
  tasks: ScheduledTask[];
  runs: TaskRun[];
  harnesses: TaskHarness[];
  timezone: string;
}
export function describeSchedule(schedule: TaskSchedule): string {
  if (schedule.kind === 'once') return 'Once · ' + new Date(schedule.at).toLocaleString();
  if (schedule.kind === 'interval') return 'Every ' + schedule.minutes + ' minutes';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    (schedule.kind === 'daily' ? 'Daily' : schedule.days.map((day) => weekdays[day]).join(', ')) +
    ' · ' +
    schedule.time +
    ' · ' +
    schedule.timezone
  );
}
