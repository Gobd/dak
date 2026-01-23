import { useEffect, useState } from 'react';
import { Users, Plus, X, Lock, Globe } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useUserStore } from '../stores/user-store';
import { useSharesStore } from '../stores/shares-store';
import { LoadingSpinner } from './ui/loading-spinner';
import { ConfirmDialog } from './ui/confirm-dialog';
import { useToastStore } from '../stores/toast-store';
import type { Note } from '../types/note';

interface NoteSharingProps {
  note: Note;
  onTogglePrivate?: (isPrivate: boolean) => void;
}

export function NoteSharing({ note, onTogglePrivate }: NoteSharingProps) {
  const { user } = useAuthStore();
  const { planLimits } = useUserStore();
  const { showToast } = useToastStore();
  const {
    noteShares,
    uniqueShareCount,
    fetchNoteShares,
    addNoteShare,
    removeNoteShare,
    fetchUniqueShareCount,
  } = useSharesStore();

  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showOwnerEmail, setShowOwnerEmail] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ userId: string; email: string } | null>(
    null,
  );

  const shares = noteShares[note.id] || [];
  const isOwner = note.user_id === user?.id;
  const canShare = planLimits.maxSharedUsers > 0;

  useEffect(() => {
    if (note.id) {
      fetchNoteShares(note.id);
    }
  }, [note.id, fetchNoteShares]);

  useEffect(() => {
    if (user?.id) {
      fetchUniqueShareCount(user.id);
    }
  }, [user?.id, fetchUniqueShareCount]);

  const handleAddShare = async () => {
    if (!user?.id || !newEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    // Check if already shared
    if (shares.some((s) => s.email === newEmail.toLowerCase().trim())) {
      showToast('This note is already shared with this person.', 'error');
      return;
    }

    setIsAdding(true);
    try {
      await addNoteShare(note.id, user.id, newEmail.trim());
      setNewEmail('');
      setShowAddForm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to share note', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveShare = (userId: string, email: string) => {
    setRemoveConfirm({ userId, email });
  };

  const confirmRemoveShare = async () => {
    if (removeConfirm) {
      await removeNoteShare(note.id, removeConfirm.userId);
      setRemoveConfirm(null);
    }
  };

  // Non-owners see a read-only view showing who shared it
  if (!isOwner) {
    const ownerDisplay = note.owner_name || note.owner_email || 'the owner';
    const hasEmail = !!note.owner_email && note.owner_name;

    return (
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-accent" />
          <div className="flex-1">
            <p className="text-sm text-text-muted">
              Shared with you by{' '}
              <button
                onClick={hasEmail ? () => setShowOwnerEmail(!showOwnerEmail) : undefined}
                className="font-medium text-accent"
              >
                {ownerDisplay}
              </button>
            </p>
            {showOwnerEmail && hasEmail && (
              <p className="text-xs mt-0.5 text-text-muted">{note.owner_email}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {note.is_private ? (
            <Lock size={16} className="text-text-muted" />
          ) : (
            <Globe size={16} className="text-warning" />
          )}
          <span className="text-sm font-medium text-text">
            {note.is_private ? 'Private Note' : 'Shared Note'}
          </span>
        </div>

        {onTogglePrivate && (
          <button
            onClick={() => onTogglePrivate(!note.is_private)}
            className="px-3 py-1.5 rounded-md text-[13px] bg-surface-sunken text-text-muted"
          >
            {note.is_private ? 'Make Shared' : 'Make Private'}
          </button>
        )}
      </div>

      {/* Share list (only for non-private notes) */}
      {!note.is_private && (
        <div className="px-4 pb-3">
          {!canShare ? (
            <p className="text-[13px] text-text-muted">Upgrade to share notes with others</p>
          ) : (
            <>
              {/* Existing shares */}
              {shares.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs mb-1.5 text-text-muted">Shared with:</p>
                  {shares.map((share) => {
                    const showName = share.display_name && share.display_name !== share.email;
                    const isExpanded = expandedUserId === share.user_id;

                    return (
                      <div
                        key={share.user_id}
                        className="flex items-center justify-between py-2 border-b border-border"
                      >
                        <button
                          onClick={
                            showName
                              ? () => setExpandedUserId(isExpanded ? null : share.user_id)
                              : undefined
                          }
                          className="flex-1 text-left"
                        >
                          <span className="text-sm text-text">
                            {share.display_name || share.email}
                          </span>
                          {isExpanded && showName && (
                            <span className="block text-xs mt-0.5 text-text-muted">
                              {share.email}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveShare(share.user_id, share.email)}
                          className="p-2 hover:opacity-70"
                        >
                          <X size={16} className="text-text-muted" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add share form */}
              {showAddForm ? (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email address"
                    autoFocus
                    className="flex-1 px-2.5 py-2 rounded-md text-sm outline-none bg-surface-sunken text-text placeholder:text-text-muted"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddShare()}
                  />
                  <button
                    onClick={handleAddShare}
                    disabled={isAdding || !newEmail.trim()}
                    className={`px-3 rounded-md text-sm flex items-center justify-center ${
                      newEmail.trim()
                        ? 'bg-warning text-black'
                        : 'bg-surface-sunken text-text-muted'
                    }`}
                  >
                    {isAdding ? <LoadingSpinner size="small" /> : 'Add'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewEmail('');
                    }}
                    className="p-2 hover:opacity-70"
                  >
                    <X size={18} className="text-text-muted" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 hover:opacity-70 text-warning"
                >
                  <Plus size={16} />
                  <span className="text-sm">Share with someone</span>
                </button>
              )}

              {/* Share count */}
              <p className="text-xs mt-2 text-text-muted">
                Sharing with {uniqueShareCount} / {planLimits.maxSharedUsers} people total
              </p>
            </>
          )}
        </div>
      )}

      {/* Remove share confirmation */}
      <ConfirmDialog
        visible={removeConfirm !== null}
        title="Remove access?"
        message={`${removeConfirm?.email || ''} will no longer be able to view or edit this note.`}
        confirmText="Remove"
        destructive
        onConfirm={confirmRemoveShare}
        onCancel={() => setRemoveConfirm(null)}
      />
    </div>
  );
}
