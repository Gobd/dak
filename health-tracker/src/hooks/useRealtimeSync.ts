import { useEffect, useCallback } from 'react';
import { subscribeToSync } from '../lib/realtime';
import { useShotsStore } from '../stores/shots-store';
import { useMedicineStore } from '../stores/medicine-store';
import { usePrnStore } from '../stores/prn-store';
import { usePeopleStore } from '../stores/people-store';

/**
 * Hook to sync data across devices using Supabase Realtime
 *
 * Uses postgres_changes on root tables (bulletproof) + broadcast for
 * granular events. Includes automatic reconnection and 5-min polling fallback.
 */
export function useRealtimeSync(userId: string | undefined) {
  const fetchSchedules = useShotsStore((s) => s.fetchSchedules);
  const fetchCourses = useMedicineStore((s) => s.fetchCourses);
  const fetchMeds = usePrnStore((s) => s.fetchMeds);
  const fetchPeople = usePeopleStore((s) => s.fetchPeople);

  // Refresh all data - used on reconnect and as polling fallback
  const refreshAll = useCallback(() => {
    fetchSchedules();
    fetchCourses();
    fetchMeds();
    fetchPeople();
  }, [fetchSchedules, fetchCourses, fetchMeds, fetchPeople]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToSync(
      userId,
      (event) => {
        // Handle postgres_changes events (bulletproof, from all tables)
        if (event.type === 'postgres_change') {
          // Map table names to specific refresh actions
          switch (event.table) {
            case 'people':
              refreshAll(); // People changes affect everything
              break;
            case 'shot_schedules':
            case 'shot_logs':
              fetchSchedules();
              break;
            case 'medicine_courses':
            case 'medicine_doses':
              fetchCourses();
              break;
            case 'prn_meds':
            case 'prn_logs':
              fetchMeds();
              break;
            default:
              refreshAll();
          }
          return;
        }

        // Handle broadcast events (granular)
        switch (event.type) {
          case 'shots':
            fetchSchedules();
            break;
          case 'medicine':
            fetchCourses();
            break;
          case 'prn':
            fetchMeds();
            break;
          case 'people':
            // People changes may affect other views
            refreshAll();
            break;
        }
      },
      refreshAll, // onReconnect callback
    );

    return () => {
      unsubscribe();
    };
  }, [userId, fetchSchedules, fetchCourses, fetchMeds, fetchPeople, refreshAll]);
}
