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
            // A note I own changed - refresh notes list
            fetchNotes(userId).then(() => {
              // If viewing a note and it's not our own pending edit, refresh editor
              const noteId = currentNoteIdRef.current;
              if (noteId && !hasPendingEdit(noteId)) {
                selectNote(noteId);
              }
            });
            if (event.eventType === 'DELETE') {
              fetchTrashedNotes(userId);
            }
            break;
          case 'note_access':
            // A shared note changed (via propagate_note_update_to_access trigger)
            // or sharing changed - refresh notes and current note if viewing
            fetchNotes(userId).then(() => {
              const noteId = currentNoteIdRef.current;
              if (noteId && !hasPendingEdit(noteId)) {
                selectNote(noteId);
              }
            });
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
          // Refetch list, and if viewing this note, refresh editor
          fetchNotes(userId).then(() => {
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
  }, [userId, enabled, fetchNotes, fetchTrashedNotes, fetchTags, selectNote, refreshData]);
}
