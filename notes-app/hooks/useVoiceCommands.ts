/**
 * Voice command handler for postMessage from dashboard.
 * Listens for commands like "add-to-list" and updates notes accordingly.
 */

import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useNotesStore } from '@/stores/notes-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';

interface VoiceCommand {
  type: string;
  item?: string;
  list?: string;
}

// Allowed origins for postMessage (dashboard URLs)
const ALLOWED_ORIGINS = [
  'http://localhost:5173', // Dev
  'http://localhost:4173', // Preview
  'https://dak-dashboard.pages.dev', // Prod
  'http://kiosk.home.arpa', // Local kiosk
];

export function useVoiceCommands() {
  const { notes, updateNote, fetchNotes } = useNotesStore();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const findNoteByTitle = useCallback(
    (listName: string) => {
      const normalizedSearch = listName.toLowerCase().trim();

      for (const note of notes) {
        const content = note.content || '';
        const firstLine = content.split('\n')[0].trim().toLowerCase();
        // Strip markdown heading markers (# ## ###)
        const title = firstLine.replace(/^#+\s*/, '');

        if (title.includes(normalizedSearch) || normalizedSearch.includes(title)) {
          return note;
        }
      }
      return null;
    },
    [notes]
  );

  const addItemToList = useCallback(
    async (item: string, listName: string) => {
      const note = findNoteByTitle(listName);

      if (!note) {
        showToast(`List "${listName}" not found`, 'error');
        return false;
      }

      // Append item as unchecked checkbox
      const currentContent = note.content || '';
      const newContent = currentContent.trimEnd() + `\n- [ ] ${item}`;

      await updateNote(note.id, { content: newContent });
      showToast(`Added "${item}" to ${listName}`, 'success');
      return true;
    },
    [findNoteByTitle, updateNote, showToast]
  );

  const handleVoiceCommand = useCallback(
    async (command: VoiceCommand) => {
      console.log('[voice] Received command:', command);

      switch (command.type) {
        case 'add-to-list':
          if (command.item && command.list) {
            await addItemToList(command.item, command.list);
          }
          break;

        case 'refresh':
          if (user?.id) {
            await fetchNotes(user.id);
            showToast('Notes refreshed', 'success');
          }
          break;

        default:
          console.log('[voice] Unknown command type:', command.type);
      }
    },
    [addItemToList, fetchNotes, user, showToast]
  );

  useEffect(() => {
    // Only set up listener on web
    if (Platform.OS !== 'web') return;

    // eslint-disable-next-line no-undef
    const handleMessage = (event: MessageEvent<VoiceCommand>) => {
      // Validate origin
      if (!ALLOWED_ORIGINS.some((origin) => event.origin.startsWith(origin))) {
        console.log('[voice] Ignoring message from unknown origin:', event.origin);
        return;
      }

      // Validate data structure
      const data = event.data as VoiceCommand;
      if (!data || typeof data.type !== 'string') {
        return;
      }

      handleVoiceCommand(data);
    };

    window.addEventListener('message', handleMessage);
    console.log('[voice] Listening for voice commands');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleVoiceCommand]);
}
