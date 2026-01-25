import { useEffect, useState } from 'react';
import { useToggle } from '@dak/hooks';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2, Clock, SquareCheck, Square, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useNotesStore } from '../stores/notes-store';
import { ConfirmModal, Spinner } from '@dak/ui';
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
  const isSelectionMode = useToggle(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const showBulkDeleteConfirm = useToggle(false);

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
    isSelectionMode.setTrue();
    setSelectedNoteIds(new Set());
  };

  const exitSelectionMode = () => {
    isSelectionMode.setFalse();
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

    showBulkDeleteConfirm.setFalse();
    exitSelectionMode();
  };

  // Check if all owned notes are selected
  const ownedNoteIds = trashedNotes.filter((n) => n.user_id === user?.id).map((n) => n.id);
  const allOwnedSelected =
    ownedNoteIds.length > 0 && ownedNoteIds.every((id) => selectedNoteIds.has(id));

  if (isLoading && trashedNotes.length === 0) {
    return <Spinner size="lg" fullScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header */}
      {isSelectionMode.value ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-sunken">
          <button onClick={toggleSelectAll} className="flex items-center gap-2">
            {allOwnedSelected ? (
              <SquareCheck size={20} className="text-warning" />
            ) : (
              <Square size={20} className="text-text-muted" />
            )}
            <span className="text-sm text-text">All</span>
          </button>
          <span className="text-sm font-medium text-text">{selectedNoteIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectedNoteIds.size > 0 && showBulkDeleteConfirm.setTrue()}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                selectedNoteIds.size > 0
                  ? 'bg-danger text-text'
                  : 'bg-surface-sunken text-text-muted'
              }`}
            >
              Delete
            </button>
            <button onClick={exitSelectionMode} className="p-1">
              <X size={20} className="text-text-muted" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Link to="/" className="p-2 -ml-2 mr-2">
            <ArrowLeft size={20} className="text-text-muted" />
          </Link>
          <Trash2 size={20} className="text-danger" />
          <span className="text-lg font-semibold ml-2 flex-1 text-text">Trash</span>
          <span className="text-sm mr-2 text-text-muted">({trashedNotes.length})</span>
          {trashedNotes.length > 0 && (
            <button onClick={enterSelectionMode} className="p-1.5">
              <SquareCheck size={20} className="text-text-muted" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {trashedNotes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Trash2 size={48} className="text-text-secondary" />
          <p className="text-base mt-4 text-text-muted">Trash is empty</p>
          <p className="text-sm mt-2 text-text-muted">Deleted notes will appear here</p>
          <p className="text-xs mt-4 text-text-muted">
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
                  if (isSelectionMode.value && canSelect) {
                    toggleNoteSelection(item.id);
                  }
                }}
                className={`flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer ${
                  isSelectionMode.value && !canSelect ? 'opacity-50' : ''
                }`}
              >
                {isSelectionMode.value && canSelect && (
                  <div className="mr-3">
                    {isChecked ? (
                      <SquareCheck size={20} className="text-warning" />
                    ) : (
                      <Square size={20} className="text-text-muted" />
                    )}
                  </div>
                )}
                <div className="flex-1 mr-4 min-w-0">
                  <p className="font-medium text-base truncate text-text">
                    {getNoteTitle(item.content)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-text-muted">
                      {item.trashed_at ? formatDate(item.trashed_at) : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className={isUrgent ? 'text-danger' : 'text-text-muted'} />
                      <span className={`text-xs ${isUrgent ? 'text-danger' : 'text-text-muted'}`}>
                        {daysRemaining === 0 ? 'Deleting soon' : `${daysRemaining}d left`}
                      </span>
                    </div>
                  </div>
                </div>
                {!isSelectionMode.value && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(item);
                      }}
                      className="p-2 rounded-lg bg-success"
                    >
                      <RotateCcw size={18} color="#ffffff" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(item);
                      }}
                      className="p-2 rounded-lg bg-danger"
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
        <div className="px-4 py-3 border-t border-border text-center">
          <span className="text-xs text-text-muted">
            Notes in trash are automatically deleted after {TRASH_RETENTION_DAYS} days
          </span>
        </div>
      )}

      <ConfirmModal
        open={noteToDelete !== null}
        title="Delete Forever"
        message={`Are you sure you want to permanently delete "${noteToDelete ? getNoteTitle(noteToDelete.content) : ''}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setNoteToDelete(null)}
      />

      <ConfirmModal
        open={showBulkDeleteConfirm.value}
        title={`Permanently delete ${selectedNoteIds.size} notes?`}
        message="This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleBulkDelete}
        onClose={() => showBulkDeleteConfirm.setFalse()}
      />
    </div>
  );
}
