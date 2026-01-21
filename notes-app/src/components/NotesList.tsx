import { FileText, Search, Hash } from 'lucide-react';
import { NoteListItem } from './NoteListItem';
import type { Note } from '../types/note';

interface NotesListProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (note: Note) => void;
  emptyStateType?: 'default' | 'search' | 'tag';
  searchQuery?: string;
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
  if (notes.length === 0) {
    if (emptyStateType === 'search') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Search size={40} className="text-zinc-300 dark:text-zinc-700" />
          <p className="text-center text-base mt-4 text-zinc-500">No matching notes</p>
          <p className="text-center text-sm mt-2 text-zinc-400">Try a different search term</p>
        </div>
      );
    }

    if (emptyStateType === 'tag') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Hash size={40} className="text-zinc-300 dark:text-zinc-700" />
          <p className="text-center text-base mt-4 text-zinc-500">No notes with this tag</p>
          <p className="text-center text-sm mt-2 text-zinc-400">
            Add this tag to notes to see them here
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <FileText size={40} className="text-zinc-300 dark:text-zinc-700" />
        <p className="text-center text-base mt-4 text-zinc-500">No notes yet</p>
        <p className="text-center text-sm mt-2 text-zinc-400">Tap + to create your first note</p>
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
          onClick={() => {
            if (selectionMode && onToggleSelect) {
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
