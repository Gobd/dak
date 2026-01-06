import { useEffect } from "react";
import { subscribeToSync } from "../lib/realtime";
import { useShotsStore } from "../stores/shots-store";
import { useMedicineStore } from "../stores/medicine-store";
import { usePrnStore } from "../stores/prn-store";
import { usePeopleStore } from "../stores/people-store";

/**
 * Hook to sync data across devices using Supabase Realtime broadcast
 *
 * When another device makes changes, this hook receives a sync event
 * and refetches the relevant data from the database.
 */
export function useRealtimeSync(userId: string | undefined) {
  const fetchSchedules = useShotsStore((s) => s.fetchSchedules);
  const fetchCourses = useMedicineStore((s) => s.fetchCourses);
  const fetchMeds = usePrnStore((s) => s.fetchMeds);
  const fetchPeople = usePeopleStore((s) => s.fetchPeople);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToSync(userId, (event) => {
      switch (event.type) {
        case "shots":
          fetchSchedules();
          break;
        case "medicine":
          fetchCourses();
          break;
        case "prn":
          fetchMeds();
          break;
        case "people":
          fetchPeople();
          // People changes may affect other views
          fetchSchedules();
          fetchCourses();
          fetchMeds();
          break;
      }
    });

    // Also refetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSchedules();
        fetchCourses();
        fetchMeds();
        fetchPeople();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, fetchSchedules, fetchCourses, fetchMeds, fetchPeople]);
}
