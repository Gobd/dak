import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2, Clock, SquareCheck, Square, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useNotesStore } from '../stores/notes-store';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { getNoteTitle } from '../types/note';
import type { Note } from '../types/note';

const TRASH_RETENTION_DAYS = 30;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysRemaining(trashedAt: string): number {
  const trashedDate = new Date(trashedAt);
  const deleteDate = new Date(trashedDate.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = deleteDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function Trash() {
  const { user } = useAuthStore();
  const { trashedNotes, isLoading, fetchTrashedNotes, restoreNote, deleteNotePermanently } =
    useNotesStore();
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchTrashedNotes(user.id);
    }
  }, [user?.id, fetchTrashedNotes]);

  const handleRestore = async (note: Note) => {
    if (!user?.id) return;
    await restoreNote(note.id, user.id);
  };

  const handleConfirmDelete = async () => {
    if (!user?.id || !noteToDelete) return;
    await deleteNotePermanently(noteToDelete.id, user.id);
    setNoteToDelete(null);
  };

  // Selection mode handlers
  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedNoteIds(new Set());
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedNoteIds(new Set());
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    // Get only user-owned notes
    const ownedNoteIds = trashedNotes.filter((n) => n.user_id === user?.id).map((n) => n.id);
    const allSelected = ownedNoteIds.every((id) => selectedNoteIds.has(id));
    if (allSelected) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(ownedNoteIds));
    }
  };

  const handleBulkDelete = async () => {
    if (!user?.id || selectedNoteIds.size === 0) return;

    // Delete all selected notes permanently
    for (const noteId of selectedNoteIds) {
      await deleteNotePermanently(noteId, user.id);
    }

    setShowBulkDeleteConfirm(false);
    exitSelectionMode();
  };

  // Check if all owned notes are selected
  const ownedNoteIds = trashedNotes.filter((n) => n.user_id === user?.id).map((n) => n.id);
  const allOwnedSelected =
    ownedNoteIds.length > 0 && ownedNoteIds.every((id) => selectedNoteIds.has(id));

  if (isLoading && trashedNotes.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      {isSelectionMode ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
          <button onClick={toggleSelectAll} className="flex items-center gap-2">
            {allOwnedSelected ? (
              <SquareCheck size={20} className="text-amber-500 dark:text-amber-400" />
            ) : (
              <Square size={20} className="text-zinc-400" />
            )}
            <span className="text-sm text-zinc-950 dark:text-white">All</span>
          </button>
          <span className="text-sm font-medium text-zinc-950 dark:text-white">
            {selectedNoteIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectedNoteIds.size > 0 && setShowBulkDeleteConfirm(true)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                selectedNoteIds.size > 0
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              }`}
            >
              Delete
            </button>
            <button onClick={exitSelectionMode} className="p-1">
              <X size={20} className="text-zinc-500" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Link to="/" className="p-2 -ml-2 mr-2">
            <ArrowLeft size={20} className="text-zinc-500" />
          </Link>
          <Trash2 size={20} className="text-red-500" />
          <span className="text-lg font-semibold ml-2 flex-1 text-zinc-950 dark:text-white">
            Trash
          </span>
          <span className="text-sm mr-2 text-zinc-500">({trashedNotes.length})</span>
          {trashedNotes.length > 0 && (
            <button onClick={enterSelectionMode} className="p-1.5">
              <SquareCheck size={20} className="text-zinc-400" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {trashedNotes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Trash2 size={48} className="text-zinc-300 dark:text-zinc-700" />
          <p className="text-base mt-4 text-zinc-500">Trash is empty</p>
          <p className="text-sm mt-2 text-zinc-500">Deleted notes will appear here</p>
          <p className="text-xs mt-4 text-zinc-500">
            Notes in trash are automatically deleted after {TRASH_RETENTION_DAYS} days
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {trashedNotes.map((item) => {
            const daysRemaining = item.trashed_at
              ? getDaysRemaining(item.trashed_at)
              : TRASH_RETENTION_DAYS;
            const isUrgent = daysRemaining <= 7;
            const canSelect = item.user_id === user?.id;
            const isChecked = selectedNoteIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isSelectionMode && canSelect) {
                    toggleNoteSelection(item.id);
                  }
                }}
                className={`flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer ${
                  isSelectionMode && !canSelect ? 'opacity-50' : ''
                }`}
              >
                {isSelectionMode && canSelect && (
                  <div className="mr-3">
                    {isChecked ? (
                      <SquareCheck size={20} className="text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Square size={20} className="text-zinc-400" />
                    )}
                  </div>
                )}
                <div className="flex-1 mr-4 min-w-0">
                  <p className="font-medium text-base truncate text-zinc-950 dark:text-white">
                    {getNoteTitle(item.content)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-zinc-500">
                      {item.trashed_at ? formatDate(item.trashed_at) : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className={isUrgent ? 'text-red-500' : 'text-zinc-400'} />
                      <span className={`text-xs ${isUrgent ? 'text-red-500' : 'text-zinc-500'}`}>
                        {daysRemaining === 0 ? 'Deleting soon' : `${daysRemaining}d left`}
                      </span>
                    </div>
                  </div>
                </div>
                {!isSelectionMode && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(item);
                      }}
                      className="p-2 rounded-lg bg-green-500"
                    >
                      <RotateCcw size={18} color="#ffffff" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(item);
                      }}
                      className="p-2 rounded-lg bg-red-500"
                    >
                      <Trash2 size={18} color="#ffffff" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help text */}
      {trashedNotes.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-xs text-zinc-500">
            Notes in trash are automatically deleted after {TRASH_RETENTION_DAYS} days
          </span>
        </div>
      )}

      <ConfirmDialog
        visible={noteToDelete !== null}
        title="Delete Forever"
        message={`Are you sure you want to permanently delete "${noteToDelete ? getNoteTitle(noteToDelete.content) : ''}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />

      <ConfirmDialog
        visible={showBulkDeleteConfirm}
        title={`Permanently delete ${selectedNoteIds.size} notes?`}
        message="This action cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </div>
  );
}
