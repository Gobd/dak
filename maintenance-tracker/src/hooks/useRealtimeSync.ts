import { useEffect } from 'react';
import { subscribeToSync } from '../lib/realtime';
import { useTasksStore } from '../stores/tasks-store';

export function useRealtimeSync(userId: string | undefined) {
  const { fetchTasks } = useTasksStore();

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToSync(
      userId,
      (event) => {
        if ('type' in event && (event.type === 'tasks' || event.type === 'logs')) {
          fetchTasks();
        }
        // Also handle postgres_changes events
        if ('table' in event) {
          fetchTasks();
        }
      },
      () => {
        // On reconnect, refresh everything
        fetchTasks();
      },
    );

    return unsubscribe;
  }, [userId, fetchTasks]);
}
