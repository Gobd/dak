import { useEffect, useState } from 'react';
import { useTasksStore } from '../stores/tasks-store';
import { TaskModal } from '../components/TaskModal';
import { Card, Button, ConfirmModal } from '@dak/ui';
import {
  Plus,
  Check,
  AlertTriangle,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  History,
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import type { MaintenanceTask } from '../types';

export function Home() {
  const { tasks, logs, loading, fetchTasks, fetchLogs, addTask, updateTask, deleteTask, markDone } =
    useTasksStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<MaintenanceTask | null>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch logs when showing history
  useEffect(() => {
    if (showHistoryFor) {
      fetchLogs(showHistoryFor);
    }
  }, [showHistoryFor, fetchLogs]);

  const getStatus = (task: MaintenanceTask) => {
    if (!task.next_due) return { status: 'unknown', label: 'Not set', color: 'text-text-muted' };

    const dueDate = new Date(task.next_due + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(dueDate) && !isToday(dueDate)) {
      const daysOverdue = differenceInDays(today, dueDate);
      return {
        status: 'overdue',
        label: daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`,
        color: 'text-danger',
      };
    }
    if (isToday(dueDate)) {
      return { status: 'today', label: 'Due today', color: 'text-warning' };
    }
    if (isTomorrow(dueDate)) {
      return { status: 'tomorrow', label: 'Due tomorrow', color: 'text-warning' };
    }

    const daysUntil = differenceInDays(dueDate, today);
    if (daysUntil <= 7) {
      return {
        status: 'soon',
        label: `Due in ${daysUntil} days`,
        color: 'text-text-secondary',
      };
    }

    return {
      status: 'ok',
      label: `Due ${format(dueDate, 'MMM d')}`,
      color: 'text-text-muted',
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overdue':
        return <AlertTriangle className="text-danger" size={18} />;
      case 'today':
      case 'tomorrow':
        return <Clock className="text-warning" size={18} />;
      default:
        return <Check className="text-success" size={18} />;
    }
  };

  const handleMarkDone = async (task: MaintenanceTask) => {
    await markDone(task.id);
  };

  const handleSaveTask = async (data: {
    name: string;
    interval_value: number;
    interval_unit: 'days' | 'weeks' | 'months';
    notes?: string;
    last_done?: string;
  }) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
      setEditingTask(null);
    } else {
      await addTask(data);
    }
  };

  const handleDeleteTask = async () => {
    if (deletingTask) {
      await deleteTask(deletingTask.id);
      setDeletingTask(null);
    }
  };

  const formatInterval = (value: number, unit: string) => {
    if (value === 1) {
      return `Every ${unit.slice(0, -1)}`;
    }
    return `Every ${value} ${unit}`;
  };

  // Sort tasks: overdue first, then by next_due
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.next_due) return 1;
    if (!b.next_due) return -1;
    return new Date(a.next_due).getTime() - new Date(b.next_due).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Maintenance</h1>
        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          Add Task
        </Button>
      </div>

      {loading && tasks.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-text-muted">Loading...</p>
        </Card>
      ) : tasks.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-text-muted mb-4">No maintenance tasks yet</p>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            Add Your First Task
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => {
            const { status, label, color } = getStatus(task);
            const taskLogs = logs[task.id] || [];

            return (
              <Card key={task.id} padding="none" className="overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  {/* Status icon */}
                  <div className="flex-shrink-0">{getStatusIcon(status)}</div>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{task.name}</div>
                    <div className="text-sm text-text-muted">
                      {formatInterval(task.interval_value, task.interval_unit)}
                      {task.last_done && (
                        <span>
                          {' '}
                          · Last: {format(new Date(task.last_done + 'T00:00:00'), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status label */}
                  <div className={`text-sm font-medium ${color} whitespace-nowrap`}>{label}</div>

                  {/* Done button */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleMarkDone(task)}
                    title="Mark as done"
                  >
                    <Check size={16} />
                    Done
                  </Button>

                  {/* Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === task.id ? null : task.id)}
                      className="p-2 text-text-muted hover:text-text transition-colors rounded-lg hover:bg-surface-sunken"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen === task.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-surface-raised border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                          <button
                            onClick={() => {
                              setShowHistoryFor(task.id);
                              setMenuOpen(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-sunken transition-colors"
                          >
                            <History size={16} />
                            History
                          </button>
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setMenuOpen(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-sunken transition-colors"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeletingTask(task);
                              setMenuOpen(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-sunken text-danger transition-colors"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* History panel */}
                {showHistoryFor === task.id && (
                  <div className="border-t border-border bg-surface-sunken p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">History</span>
                      <button
                        onClick={() => setShowHistoryFor(null)}
                        className="text-sm text-text-muted hover:text-text"
                      >
                        Close
                      </button>
                    </div>
                    {taskLogs.length === 0 ? (
                      <p className="text-sm text-text-muted">No history yet</p>
                    ) : (
                      <div className="space-y-1">
                        {taskLogs.map((log) => (
                          <div key={log.id} className="text-sm flex justify-between">
                            <span>{format(new Date(log.completed_at), 'MMM d, yyyy h:mm a')}</span>
                            {log.notes && (
                              <span className="text-text-muted truncate ml-2">{log.notes}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <TaskModal
        isOpen={showAddModal || editingTask !== null}
        onClose={() => {
          setShowAddModal(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        task={editingTask}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deletingTask !== null}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${deletingTask?.name}"? This will also delete all history.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
