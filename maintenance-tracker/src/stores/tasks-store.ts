import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { MaintenanceTask, MaintenanceLog } from '../types';
import { addDays, addWeeks, addMonths, format } from 'date-fns';

function calculateNextDue(
  fromDate: Date,
  intervalValue: number,
  intervalUnit: 'days' | 'weeks' | 'months',
): string {
  let nextDue: Date;
  switch (intervalUnit) {
    case 'weeks':
      nextDue = addWeeks(fromDate, intervalValue);
      break;
    case 'months':
      nextDue = addMonths(fromDate, intervalValue);
      break;
    default:
      nextDue = addDays(fromDate, intervalValue);
  }
  return format(nextDue, 'yyyy-MM-dd');
}

// Notify parent dashboard of task changes (for notifications)
function notifyDashboard(task: MaintenanceTask) {
  try {
    const notify = (window.parent as Window & { notify?: (data: unknown) => void })?.notify;
    if (notify && task.next_due) {
      notify({
        type: 'maintenance',
        name: task.name,
        due: task.next_due,
        data: {
          interval: `${task.interval_value} ${task.interval_unit}`,
        },
      });
    }
  } catch {
    // Ignore errors when not in iframe
  }
}

function syncAllTasksToDashboard(tasks: MaintenanceTask[]) {
  tasks.filter((t) => t.next_due).forEach(notifyDashboard);
}

interface TasksState {
  tasks: MaintenanceTask[];
  logs: Record<string, MaintenanceLog[]>;
  loading: boolean;
  fetchTasks: () => Promise<void>;
  fetchLogs: (taskId: string) => Promise<void>;
  addTask: (data: {
    name: string;
    interval_value: number;
    interval_unit: 'days' | 'weeks' | 'months';
    notes?: string;
    last_done?: string; // yyyy-MM-dd format, for setting initial "last done" date
  }) => Promise<void>;
  updateTask: (id: string, data: Partial<MaintenanceTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  markDone: (taskId: string, notes?: string, completedAt?: Date) => Promise<boolean>;
  deleteLog: (taskId: string, logId: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  logs: {},
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('maint_tasks')
      .select('*')
      .order('next_due', { ascending: true, nullsFirst: false });

    if (!error && data) {
      set({ tasks: data });
      syncAllTasksToDashboard(data);
    }
    set({ loading: false });
  },

  fetchLogs: async (taskId: string) => {
    const { data, error } = await supabase
      .from('maint_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      set((state) => ({
        logs: { ...state.logs, [taskId]: data },
      }));
    }
  },

  addTask: async (data) => {
    // Calculate next_due from last_done if provided, otherwise from today
    const fromDate = data.last_done ? new Date(data.last_done + 'T00:00:00') : new Date();
    const nextDue = calculateNextDue(fromDate, data.interval_value, data.interval_unit);

    const { error } = await supabase.from('maint_tasks').insert({
      name: data.name,
      interval_value: data.interval_value,
      interval_unit: data.interval_unit,
      notes: data.notes || null,
      last_done: data.last_done || null,
      next_due: nextDue,
    });

    if (!error) {
      get().fetchTasks();
      broadcastSync({ type: 'tasks' });
    }
  },

  updateTask: async (id: string, data: Partial<MaintenanceTask>) => {
    const { error } = await supabase.from('maint_tasks').update(data).eq('id', id);

    if (!error) {
      // If interval changed, recalculate next_due from last_done
      if (data.interval_value || data.interval_unit) {
        const task = get().tasks.find((t) => t.id === id);
        if (task) {
          const intervalValue = data.interval_value ?? task.interval_value;
          const intervalUnit = data.interval_unit ?? task.interval_unit;
          const fromDate = task.last_done ? new Date(task.last_done + 'T00:00:00') : new Date();
          const newNextDue = calculateNextDue(fromDate, intervalValue, intervalUnit);
          await supabase.from('maint_tasks').update({ next_due: newNextDue }).eq('id', id);
        }
      }
      get().fetchTasks();
      broadcastSync({ type: 'tasks' });
    }
  },

  deleteTask: async (id: string) => {
    const { error } = await supabase.from('maint_tasks').delete().eq('id', id);

    if (!error) {
      get().fetchTasks();
      broadcastSync({ type: 'tasks' });
    }
  },

  markDone: async (taskId: string, notes?: string, completedAt?: Date) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const doneTime = completedAt || new Date();
    const doneDate = format(doneTime, 'yyyy-MM-dd');

    // Log the completion
    const { error } = await supabase.from('maint_logs').insert({
      task_id: taskId,
      completed_at: doneTime.toISOString(),
      notes: notes || null,
    });

    if (error) return false;

    // Update task with new last_done and next_due
    const nextDue = calculateNextDue(doneTime, task.interval_value, task.interval_unit);
    await supabase
      .from('maint_tasks')
      .update({
        last_done: doneDate,
        next_due: nextDue,
      })
      .eq('id', taskId);

    get().fetchTasks();
    get().fetchLogs(taskId);
    broadcastSync({ type: 'tasks' });
    return true;
  },

  deleteLog: async (taskId: string, logId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const { error } = await supabase.from('maint_logs').delete().eq('id', logId);

    if (error) return;

    // Fetch remaining logs to recalculate last_done and next_due
    const { data: remainingLogs } = await supabase
      .from('maint_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('completed_at', { ascending: false })
      .limit(1);

    if (remainingLogs && remainingLogs.length > 0) {
      const lastLog = remainingLogs[0];
      const lastDone = format(new Date(lastLog.completed_at), 'yyyy-MM-dd');
      const nextDue = calculateNextDue(
        new Date(lastLog.completed_at),
        task.interval_value,
        task.interval_unit,
      );
      await supabase
        .from('maint_tasks')
        .update({ last_done: lastDone, next_due: nextDue })
        .eq('id', taskId);
    } else {
      // No logs left - reset to no last_done, next_due from today
      const nextDue = calculateNextDue(new Date(), task.interval_value, task.interval_unit);
      await supabase
        .from('maint_tasks')
        .update({ last_done: null, next_due: nextDue })
        .eq('id', taskId);
    }

    get().fetchTasks();
    get().fetchLogs(taskId);
    broadcastSync({ type: 'tasks' });
  },
}));
