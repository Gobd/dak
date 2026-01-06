import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { subscribeToSync } from '@/lib/realtime';
import { useNotesStore } from '@/stores/notes-store';
import { useTagsStore } from '@/stores/tags-store';

/**
 * Hook to sync data across devices using Supabase Realtime broadcast
 *
 * When another device makes changes, this hook receives a "ping"
 * and refetches the relevant data from the database.
 *
 * @param userId - The user's ID
 * @param enabled - Whether live sync is enabled (based on plan)
 */
export function useRealtimeSync(userId: string | undefined, enabled: boolean = true) {
  const fetchNotes = useNotesStore((s) => s.fetchNotes);
  const fetchTrashedNotes = useNotesStore((s) => s.fetchTrashedNotes);
  const selectNote = useNotesStore((s) => s.selectNote);
  const currentNote = useNotesStore((s) => s.currentNote);
  const fetchTags = useTagsStore((s) => s.fetchTags);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    // Subscribe to sync events from other devices
    const unsubscribe = subscribeToSync(userId, (event) => {
      switch (event.type) {
        case 'note_changed':
          // Always refetch list (updates order, timestamps, previews)
          // If viewing this note, also reselect to refresh editor
          fetchNotes(userId).then(() => {
            if (currentNote?.id === event.noteId) {
              selectNote(event.noteId);
            }
          });
          break;

        case 'note_created':
        case 'notes_refresh':
          fetchNotes(userId);
          break;

        case 'note_trashed':
        case 'note_restored':
        case 'note_deleted':
          // Refresh both lists - note moved between them
          fetchNotes(userId);
          fetchTrashedNotes(userId);
          break;

        case 'tags_refresh':
          fetchTags(userId);
          break;
      }
    });

    // Also refetch when app comes back to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchNotes(userId);
      }
      appState.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Web: use Page Visibility API for tab focus/background
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotes(userId);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      unsubscribe();
      subscription.remove();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [userId, enabled, currentNote?.id, fetchNotes, fetchTrashedNotes, fetchTags, selectNote]);
}
