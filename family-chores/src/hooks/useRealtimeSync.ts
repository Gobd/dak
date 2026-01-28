import { useEffect, useCallback } from 'react';
import { subscribeToSync } from '../lib/realtime';
import { useMembersStore } from '../stores/members-store';
import { useChoresStore } from '../stores/chores-store';
import { useInstancesStore } from '../stores/instances-store';
import { usePointsStore } from '../stores/points-store';
import { useGoalsStore } from '../stores/goals-store';
import { useSettingsStore } from '../stores/settings-store';
import type { SyncEvent } from '../types';
import type { PostgresChangeEvent } from '@dak/ui';

/**
 * Hook to sync data across devices using Supabase Realtime
 *
 * Uses postgres_changes on root tables (bulletproof) + broadcast for
 * granular events. Includes automatic reconnection and 5-min polling fallback.
 */
export function useRealtimeSync(userId: string | undefined) {
  // Refresh all data - used on reconnect and as polling fallback
  const refreshAll = useCallback(() => {
    useMembersStore.getState().fetchMembers();
    useChoresStore.getState().fetchChores();
    useInstancesStore.getState().fetchInstancesForDate(useInstancesStore.getState().currentDate);
    usePointsStore.getState().fetchBalances();
    usePointsStore.getState().fetchPeriodPoints(usePointsStore.getState().currentPeriod);
    useGoalsStore.getState().fetchGoalProgress();
    useSettingsStore.getState().fetchSettings();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const handleSync = (event: SyncEvent | PostgresChangeEvent) => {
      // Handle postgres_changes events (from root tables)
      if (event.type === 'postgres_change') {
        // Root table changed - refresh everything to be safe
        refreshAll();
        return;
      }

      // Handle broadcast events (granular)
      switch (event.type) {
        case 'members':
          useMembersStore.getState().fetchMembers();
          break;
        case 'chores':
          useChoresStore.getState().fetchChores();
          useGoalsStore.getState().fetchGoalProgress();
          break;
        case 'instances':
          useInstancesStore
            .getState()
            .fetchInstancesForDate(useInstancesStore.getState().currentDate);
          break;
        case 'points':
          usePointsStore.getState().fetchBalances();
          usePointsStore.getState().fetchPeriodPoints(usePointsStore.getState().currentPeriod);
          break;
        case 'goals':
          useGoalsStore.getState().fetchGoalProgress();
          break;
        case 'settings':
          useSettingsStore.getState().fetchSettings();
          break;
      }
    };

    const unsubscribe = subscribeToSync(userId, handleSync, refreshAll);
    return unsubscribe;
  }, [userId, refreshAll]);
}
