import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Users from 'lucide-react-native/dist/esm/icons/users';
import Plus from 'lucide-react-native/dist/esm/icons/plus';
import X from 'lucide-react-native/dist/esm/icons/x';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import Globe from 'lucide-react-native/dist/esm/icons/globe';
import { useAuthStore } from '@/stores/auth-store';
import { useUserStore } from '@/stores/user-store';
import { useSharesStore } from '@/stores/shares-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToastStore } from '@/stores/toast-store';
import type { Note } from '@/types/note';

interface NoteSharingProps {
  note: Note;
  onTogglePrivate?: (isPrivate: boolean) => void;
}

export function NoteSharing({ note, onTogglePrivate }: NoteSharingProps) {
  const colors = useThemeColors();
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
    null
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
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Users size={16} color={colors.info || '#3b82f6'} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              Shared with you by{' '}
              <Text
                style={{ color: colors.info || '#3b82f6', fontWeight: '500' }}
                onPress={hasEmail ? () => setShowOwnerEmail(!showOwnerEmail) : undefined}
              >
                {ownerDisplay}
              </Text>
            </Text>
            {showOwnerEmail && hasEmail && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {note.owner_email}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {note.is_private ? (
            <Lock size={16} color={colors.iconMuted} />
          ) : (
            <Globe size={16} color={colors.primary} />
          )}
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
            {note.is_private ? 'Private Note' : 'Shared Note'}
          </Text>
        </View>

        {onTogglePrivate && (
          <Pressable
            onPress={() => onTogglePrivate(!note.is_private)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: colors.bgTertiary,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
              {note.is_private ? 'Make Shared' : 'Make Private'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Share list (only for non-private notes) */}
      {!note.is_private && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {!canShare ? (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Upgrade to share notes with others
            </Text>
          ) : (
            <>
              {/* Existing shares */}
              {shares.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>
                    Shared with:
                  </Text>
                  {shares.map((share) => {
                    const showName = share.display_name && share.display_name !== share.email;
                    const isExpanded = expandedUserId === share.user_id;

                    return (
                      <View
                        key={share.user_id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Pressable
                          onPress={
                            showName
                              ? () => setExpandedUserId(isExpanded ? null : share.user_id)
                              : undefined
                          }
                          style={{ flex: 1 }}
                        >
                          <Text style={{ color: colors.text, fontSize: 14 }}>
                            {share.display_name || share.email}
                          </Text>
                          {isExpanded && showName && (
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                              {share.email}
                            </Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => handleRemoveShare(share.user_id, share.email)}
                          hitSlop={8}
                          style={{ padding: 8 }}
                        >
                          <X size={16} color={colors.iconMuted} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Add share form */}
              {showAddForm ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="Email address"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                    style={{
                      flex: 1,
                      backgroundColor: colors.bgSecondary,
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      color: colors.text,
                      fontSize: 14,
                    }}
                  />
                  <Pressable
                    onPress={handleAddShare}
                    disabled={isAdding || !newEmail.trim()}
                    style={{
                      backgroundColor: newEmail.trim() ? colors.primary : colors.bgTertiary,
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      justifyContent: 'center',
                    }}
                  >
                    {isAdding ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      <Text
                        style={{
                          color: newEmail.trim() ? colors.primaryText : colors.iconMuted,
                          fontSize: 14,
                        }}
                      >
                        Add
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowAddForm(false);
                      setNewEmail('');
                    }}
                    style={{ padding: 8 }}
                  >
                    <X size={18} color={colors.iconMuted} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowAddForm(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 14 }}>Share with someone</Text>
                </Pressable>
              )}

              {/* Share count */}
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                Sharing with {uniqueShareCount} / {planLimits.maxSharedUsers} people total
              </Text>
            </>
          )}
        </View>
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
    </View>
  );
}
