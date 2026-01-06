import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import type { Note } from '@/types/note';
import type { Tag } from '@/types/tag';

/**
 * Simplenote-compatible export format
 */
interface SimplenoteExport {
  activeNotes: SimplenoteNote[];
  trashedNotes: SimplenoteNote[];
}

interface SimplenoteNote {
  id: string;
  content: string;
  creationDate: string;
  lastModified: string;
  tags: string[];
  pinned?: boolean;
  private?: boolean;
  collaboratorEmails?: string[];
}

interface NoteShare {
  user_id: string;
  email: string;
  display_name: string | null;
}

interface ExportParams {
  notes: Note[];
  trashedNotes?: Note[];
  tags: Tag[];
  noteTagsMap: Record<string, string[]>; // noteId -> tagIds[]
  noteSharesMap: Record<string, NoteShare[]>; // noteId -> shares[]
}

/**
 * Export notes in Simplenote-compatible JSON format
 */
export async function exportNotesAsZip({
  notes,
  trashedNotes = [],
  tags,
  noteTagsMap,
  noteSharesMap,
}: ExportParams): Promise<void> {
  if (notes.length === 0 && trashedNotes.length === 0) {
    throw new Error('No notes to export');
  }

  // Build tag id -> name lookup
  const tagNameMap = new Map(tags.map((t) => [t.id, t.name]));

  // Convert note to Simplenote format
  const toSimplenoteNote = (note: Note): SimplenoteNote => {
    const tagIds = noteTagsMap[note.id] || [];
    const tagNames = tagIds.map((id) => tagNameMap.get(id)).filter(Boolean) as string[];

    const shares = noteSharesMap[note.id] || [];
    const collaboratorEmails = shares.map((s) => s.email);

    return {
      id: note.id,
      content: note.content || '',
      creationDate: note.created_at,
      lastModified: note.updated_at,
      tags: tagNames,
      pinned: note.pinned || undefined,
      private: note.is_private || undefined,
      collaboratorEmails: collaboratorEmails.length > 0 ? collaboratorEmails : undefined,
    };
  };

  const exportData: SimplenoteExport = {
    activeNotes: notes.map(toSimplenoteNote),
    trashedNotes: trashedNotes.map(toSimplenoteNote),
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `simplenotes_export_${timestamp}.json`;

  if (Platform.OS === 'web') {
    // Web: trigger download via blob URL
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Native: save to file system and share
    const file = new File(Paths.cache, filename);
    await file.write(jsonContent);

    if (await isAvailableAsync()) {
      await shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Notes',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }
}
