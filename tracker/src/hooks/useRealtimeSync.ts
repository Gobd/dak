import { useEffect } from 'react';
import { subscribeToSync } from '../lib/realtime';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { usePresetsStore } from '../stores/presets-store';
import { usePreferencesStore } from '../stores/preferences-store';

/**
 * Hook to sync data across devices using Supabase Realtime broadcast
 *
 * When another device makes changes, this hook receives a sync event
 * and refetches the relevant data from the database.
 */
export function useRealtimeSync(userId: string | undefined) {
  const fetchTodayEntries = useEntriesStore((s) => s.fetchTodayEntries);
  const fetchEntries = useEntriesStore((s) => s.fetchEntries);
  const fetchTarget = useTargetsStore((s) => s.fetchTarget);
  const fetchPresets = usePresetsStore((s) => s.fetchPresets);
  const fetchPreferences = usePreferencesStore((s) => s.fetchPreferences);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToSync(userId, (event) => {
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

    // Also refetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTodayEntries();
        fetchEntries();
        fetchTarget();
        fetchPresets();
        fetchPreferences();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, fetchTodayEntries, fetchEntries, fetchTarget, fetchPresets, fetchPreferences]);
}
