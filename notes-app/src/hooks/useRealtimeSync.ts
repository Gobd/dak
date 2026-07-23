import { useEffect, useRef, useCallback } from 'react';
import { subscribeToSync } from '../lib/realtime';
import type { SyncEvent } from '../lib/realtime';
import { useNotesStore, hasPendingEdit } from '../stores/notes-store';
import { useTagsStore } from '../stores/tags-store';
import type { PostgresChangeEvent } from '@dak/ui';

/**
 * Hook to sync data across devices using Supabase Realtime
 *
 * Uses postgres_changes for owned notes (bulletproof, DB-triggered) and
 * broadcast for shared notes (fast notification from other users).
 * Includes polling fallback every 5 minutes as insurance.
 */
export function useRealtimeSync(userId: string | undefined, enabled: boolean = true) {
  const fetchNotes = useNotesStore((s) => s.fetchNotes);
  const fetchTrashedNotes = useNotesStore((s) => s.fetchTrashedNotes);
  const refreshNote = useNotesStore((s) => s.refreshNote);
  const selectNote = useNotesStore((s) => s.selectNote);
  const fetchTags = useTagsStore((s) => s.fetchTags);

  // Use ref for currentNote to avoid re-subscribing when note changes
  const currentNoteIdRef = useRef<string | null>(null);

  // Keep ref updated
  const currentNote = useNotesStore((s) => s.currentNote);
  useEffect(() => {
    currentNoteIdRef.current = currentNote?.id ?? null;
  }, [currentNote?.id]);

  // Refresh all data - used on reconnect and as polling fallback
  const refreshData = useCallback(() => {
    if (!userId) return;
    fetchNotes(userId);
    fetchTrashedNotes(userId);
    fetchTags(userId);
  }, [userId, fetchNotes, fetchTrashedNotes, fetchTags]);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    // Handle sync events from realtime
    const handleEvent = (event: SyncEvent | PostgresChangeEvent) => {
      // Handle postgres_changes events (bulletproof, from watched tables)
      if (event.type === 'postgres_change') {
        switch (event.table) {
          case 'notes':
            if (event.eventType === 'DELETE') {
              // Note permanently deleted — remove from list and refresh trash
              fetchNotes(userId);
              fetchTrashedNotes(userId);
            } else if (event.record?.id) {
              // Single note changed — upsert it without fetching the whole list
              refreshNote(event.record.id as string);
            } else {
              fetchNotes(userId);
            }
            break;
          case 'note_access':
            // Sharing changed — need full list refresh (shared set may have changed)
            fetchNotes(userId);
            break;
          case 'tags':
            fetchTags(userId);
            break;
          default:
            refreshData();
        }
        return;
      }

      // Handle broadcast events (from shared notes)
      switch (event.type) {
        case 'note_changed':
          // Single note changed on another device — upsert just that note
          refreshNote(event.noteId).then(() => {
            if (currentNoteIdRef.current === event.noteId && !hasPendingEdit(event.noteId)) {
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
          // Note moved between lists
          fetchNotes(userId);
          fetchTrashedNotes(userId);
          break;

        case 'tags_refresh':
          fetchTags(userId);
          break;
      }
    };

    // Subscribe with reconnect callback for data refresh
    const unsubscribe = subscribeToSync(userId, handleEvent, refreshData);

    return () => {
      unsubscribe();
    };
  }, [userId, enabled, fetchNotes, fetchTrashedNotes, fetchTags, selectNote, refreshNote, refreshData]);
}
