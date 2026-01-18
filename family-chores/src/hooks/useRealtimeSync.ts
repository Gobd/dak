import { useEffect } from 'react';
import { subscribeToSync } from '../lib/realtime';
import { useMembersStore } from '../stores/members-store';
import { useChoresStore } from '../stores/chores-store';
import { useInstancesStore } from '../stores/instances-store';
import { usePointsStore } from '../stores/points-store';
import { useGoalsStore } from '../stores/goals-store';
import { useSettingsStore } from '../stores/settings-store';
import type { SyncEvent } from '../types';

export function useRealtimeSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const handleSync = (event: SyncEvent) => {
      switch (event.type) {
        case 'members':
          useMembersStore.getState().fetchMembers();
          break;
        case 'chores':
          useChoresStore.getState().fetchChores();
          // Also refresh goals since they come from chores
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

    const unsubscribe = subscribeToSync(userId, handleSync);
    return unsubscribe;
  }, [userId]);
}
