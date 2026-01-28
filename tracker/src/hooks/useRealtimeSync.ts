import { useEffect, useCallback } from 'react';
import { subscribeToSync } from '../lib/realtime';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { usePresetsStore } from '../stores/presets-store';
import { usePreferencesStore } from '../stores/preferences-store';

/**
 * Hook to sync data across devices using Supabase Realtime
 *
 * Uses broadcast for cross-device sync. Includes automatic reconnection
 * and visibility change handling via the shared RealtimeSync library.
 */
export function useRealtimeSync(userId: string | undefined) {
  const fetchTodayEntries = useEntriesStore((s) => s.fetchTodayEntries);
  const fetchEntries = useEntriesStore((s) => s.fetchEntries);
  const fetchTarget = useTargetsStore((s) => s.fetchTarget);
  const fetchPresets = usePresetsStore((s) => s.fetchPresets);
  const fetchPreferences = usePreferencesStore((s) => s.fetchPreferences);

  // Refresh all data
  const refreshAll = useCallback(() => {
    fetchTodayEntries();
    fetchEntries();
    fetchTarget();
    fetchPresets();
    fetchPreferences();
  }, [fetchTodayEntries, fetchEntries, fetchTarget, fetchPresets, fetchPreferences]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToSync(userId, (event) => {
      // Handle postgres_change events (if tables are configured)
      if (event.type === 'postgres_change') {
        refreshAll();
        return;
      }

      // Handle broadcast events
      switch (event.type) {
        case 'entries':
          fetchTodayEntries();
          fetchEntries();
          break;
        case 'targets':
          fetchTarget();
          break;
        case 'presets':
          fetchPresets();
          break;
        case 'preferences':
          fetchPreferences();
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    userId,
    fetchTodayEntries,
    fetchEntries,
    fetchTarget,
    fetchPresets,
    fetchPreferences,
    refreshAll,
  ]);
}
