import { FileText, Search, Hash } from 'lucide-react';
import { useThemeColors } from '../hooks/useThemeColors';
import { NoteListItem } from './NoteListItem';
import type { Note } from '../types/note';

interface NotesListProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (note: Note) => void;
  emptyStateType?: 'default' | 'search' | 'tag';
  searchQuery?: string;
  // Selection mode props
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  currentUserId?: string;
}

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  emptyStateType = 'default',
  searchQuery,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  currentUserId,
}: NotesListProps) {
  const colors = useThemeColors();

  if (notes.length === 0) {
    if (emptyStateType === 'search') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Search size={40} color={colors.borderLight} />
          <p className="text-center text-base mt-4" style={{ color: colors.textMuted }}>
            No matching notes
          </p>
          <p className="text-center text-sm mt-2" style={{ color: colors.textTertiary }}>
            Try a different search term
          </p>
        </div>
      );
    }

    if (emptyStateType === 'tag') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Hash size={40} color={colors.borderLight} />
          <p className="text-center text-base mt-4" style={{ color: colors.textMuted }}>
            No notes with this tag
          </p>
          <p className="text-center text-sm mt-2" style={{ color: colors.textTertiary }}>
            Add this tag to notes to see them here
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <FileText size={40} color={colors.borderLight} />
        <p className="text-center text-base mt-4" style={{ color: colors.textMuted }}>
          No notes yet
        </p>
        <p className="text-center text-sm mt-2" style={{ color: colors.textTertiary }}>
          Tap + to create your first note
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {notes.map((note) => (
        <NoteListItem
          key={note.id}
          note={note}
          isSelected={note.id === selectedNoteId}
          onPress={() => {
            if (selectionMode && onToggleSelect) {
              // Only allow selecting notes owned by the user
              if (note.user_id === currentUserId) {
                onToggleSelect(note.id);
              }
            } else {
              onSelectNote(note);
            }
          }}
          searchQuery={searchQuery}
          selectionMode={selectionMode}
          isChecked={selectedIds.has(note.id)}
          canSelect={note.user_id === currentUserId}
        />
      ))}
    </div>
  );
}
