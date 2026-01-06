import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plan, PLAN_LIMITS } from '@/constants/plan-limits';
import { useTheme, useThemeColors } from '@/hooks/useThemeColors';
import { notesApi } from '@/lib/api/notes';
import { sharesApi } from '@/lib/api/shares';
import { exportNotesAsZip } from '@/lib/export-notes';
import { importNotesFromFiles } from '@/lib/import-notes';
import { useAuthStore } from '@/stores/auth-store';
import { useNotesStore } from '@/stores/notes-store';
import { useSharesStore } from '@/stores/shares-store';
import { useTagsStore } from '@/stores/tags-store';
import { useToastStore } from '@/stores/toast-store';
import { useUserStore } from '@/stores/user-store';
import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/dist/esm/icons/arrow-left';
import Check from 'lucide-react-native/dist/esm/icons/check';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react-native/dist/esm/icons/chevron-right';
import Download from 'lucide-react-native/dist/esm/icons/download';
import FileText from 'lucide-react-native/dist/esm/icons/file-text';
import Moon from 'lucide-react-native/dist/esm/icons/moon';
import Plus from 'lucide-react-native/dist/esm/icons/plus';
import Sun from 'lucide-react-native/dist/esm/icons/sun';
import Upload from 'lucide-react-native/dist/esm/icons/upload';
import User from 'lucide-react-native/dist/esm/icons/user';
import Users from 'lucide-react-native/dist/esm/icons/users';
import X from 'lucide-react-native/dist/esm/icons/x';
import Zap from 'lucide-react-native/dist/esm/icons/zap';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { toggleTheme, isDark } = useTheme();
  const { user } = useAuthStore();
  const { profile, planLimits, fetchProfile, updateDisplayName, updatePlan } = useUserStore();
  const {
    defaultShares,
    uniqueShareCount,
    noteShares,
    fetchDefaultShares,
    addDefaultShare,
    removeDefaultShare,
    fetchUniqueShareCount,
  } = useSharesStore();
  const { notes, trashedNotes, fetchNotes, fetchTrashedNotes } = useNotesStore();
  const { tags, noteTagsMap, fetchTags, addTagToNote, createTag } = useTagsStore();
  const { showToast } = useToastStore();

  const [newEmail, setNewEmail] = useState('');
  const [isAddingShare, setIsAddingShare] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [removeShareConfirm, setRemoveShareConfirm] = useState<string | null>(null);
  const [importConfirm, setImportConfirm] = useState<{
    notes: Awaited<ReturnType<typeof importNotesFromFiles>>;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
      fetchDefaultShares(user.id);
      fetchUniqueShareCount(user.id);
      fetchTrashedNotes(user.id);
    }
  }, [user?.id, fetchProfile, fetchDefaultShares, fetchUniqueShareCount, fetchTrashedNotes]);

  // Sync display name with profile
  useEffect(() => {
    if (profile?.display_name !== undefined) {
      setDisplayName(profile.display_name || '');
    }
  }, [profile?.display_name]);

  const handleSaveDisplayName = async () => {
    if (!user?.id) return;
    setIsSavingName(true);
    try {
      await updateDisplayName(user.id, displayName);
      setIsEditingName(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save name', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAddDefaultShare = async () => {
    if (!user?.id || !newEmail.trim()) return;

    // Check plan limit
    if (uniqueShareCount >= planLimits.maxSharedUsers) {
      showToast(
        `Your ${profile?.plan} plan allows sharing with ${planLimits.maxSharedUsers} people. Upgrade to share with more.`,
        'error'
      );
      return;
    }

    // Basic email validation
    if (!newEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    setIsAddingShare(true);
    try {
      await addDefaultShare(user.id, newEmail.trim());
      setNewEmail('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add share', 'error');
    } finally {
      setIsAddingShare(false);
    }
  };

  const handleRemoveShare = (shareId: string) => {
    setRemoveShareConfirm(shareId);
  };

  const confirmRemoveShare = async () => {
    if (removeShareConfirm) {
      await removeDefaultShare(removeShareConfirm);
      setRemoveShareConfirm(null);
    }
  };

  const handleChangePlan = async (plan: Plan) => {
    if (!user?.id) return;
    try {
      await updatePlan(user.id, plan);
      setShowPlanPicker(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleExport = async () => {
    if (notes.length === 0 && trashedNotes.length === 0) {
      showToast('You have no notes to export.', 'error');
      return;
    }
    setIsExporting(true);
    try {
      await exportNotesAsZip({
        notes,
        trashedNotes,
        tags,
        noteTagsMap,
        noteSharesMap: noteShares,
      });
      const parts = [];
      if (notes.length > 0) parts.push(`${notes.length} notes`);
      if (trashedNotes.length > 0) parts.push(`${trashedNotes.length} trashed`);
      showToast(`Exported ${parts.join(', ')}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export notes', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!user?.id) return;

    setIsImporting(true);
    try {
      const importedNotes = await importNotesFromFiles();

      // Check note limit
      if (planLimits.maxNotes !== null) {
        const availableSlots = planLimits.maxNotes - notes.length;
        if (importedNotes.length > availableSlots) {
          showToast(
            `You can only import ${availableSlots} more notes on your current plan. Selected ${importedNotes.length} notes.`,
            'error'
          );
          setIsImporting(false);
          return;
        }
      }

      // Count private vs public vs trashed
      const activeNotes = importedNotes.filter((n) => !n.isTrashed);
      const trashedCount = importedNotes.filter((n) => n.isTrashed).length;
      const privateCount = activeNotes.filter((n) => n.isPrivate).length;
      const publicCount = activeNotes.length - privateCount;
      const tagsCount = new Set(importedNotes.flatMap((n) => n.tags)).size;
      const collaboratorEmails = new Set(importedNotes.flatMap((n) => n.collaboratorEmails || []));

      const parts: string[] = [];
      if (activeNotes.length > 0) {
        if (privateCount === activeNotes.length) {
          parts.push(`${activeNotes.length} private`);
        } else if (publicCount === activeNotes.length) {
          parts.push(`${activeNotes.length} public`);
        } else {
          parts.push(`${privateCount} private, ${publicCount} public`);
        }
      }
      if (trashedCount > 0) {
        parts.push(`${trashedCount} in trash`);
      }
      const summary = parts.join(', ') + '.';
      const tagsSummary = tagsCount > 0 ? ` ${tagsCount} unique tags.` : '';
      const sharesSummary =
        collaboratorEmails.size > 0
          ? ` Will attempt to share with ${collaboratorEmails.size} collaborator${collaboratorEmails.size > 1 ? 's' : ''}.`
          : '';

      // Show confirmation dialog
      setImportConfirm({
        notes: importedNotes,
        message: `Import ${importedNotes.length} notes?${tagsSummary}${sharesSummary} ${summary}`,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'No file selected') {
        // User cancelled, don't show error
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to import notes', 'error');
      }
      setIsImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!user?.id || !importConfirm) return;

    const importedNotes = importConfirm.notes;
    setImportConfirm(null);

    try {
      let imported = 0;

      // Build tag name -> id map, create missing tags
      const tagNameToId = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));
      const uniqueTagNames = new Set(importedNotes.flatMap((n) => n.tags));

      for (const tagName of uniqueTagNames) {
        if (!tagNameToId.has(tagName.toLowerCase())) {
          const newTag = await createTag({
            user_id: user.id,
            name: tagName,
            color: null,
          });
          if (newTag) {
            tagNameToId.set(tagName.toLowerCase(), newTag.id);
          }
        }
      }

      for (const importNote of importedNotes) {
        // Create note with all metadata
        const newNote = await notesApi.create({
          user_id: user.id,
          content: importNote.content,
          is_private: importNote.isPrivate,
          pinned: importNote.pinned,
          trashed_at: importNote.isTrashed
            ? importNote.updatedAt || new Date().toISOString()
            : null,
          trashed_by: importNote.isTrashed ? user.id : null,
          created_at: importNote.createdAt,
          updated_at: importNote.updatedAt || importNote.createdAt,
        });

        // Add tags to the note
        for (const tagName of importNote.tags) {
          const tagId = tagNameToId.get(tagName.toLowerCase());
          if (tagId) {
            await addTagToNote(newNote.id, tagId);
          }
        }

        // Add shares if note is public and has collaborators
        if (!importNote.isPrivate && importNote.collaboratorEmails?.length) {
          for (const email of importNote.collaboratorEmails) {
            try {
              await sharesApi.addNoteShare(newNote.id, user.id, email);
            } catch {
              // Silently skip - user may not exist or share limit reached
            }
          }
        }

        imported++;
      }

      // Refresh notes and tags lists
      await fetchNotes(user.id);
      await fetchTrashedNotes(user.id);
      await fetchTags(user.id);

      showToast(`Imported ${imported} notes.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import some notes', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const cancelImport = () => {
    setImportConfirm(null);
    setIsImporting(false);
  };

  const noteCount = notes.length;
  const atNoteLimit = planLimits.maxNotes !== null && noteCount >= planLimits.maxNotes;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.replace('/')} style={{ padding: 8, marginLeft: -8 }}>
          <ArrowLeft size={20} color={colors.icon} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>
          Settings
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Appearance Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Appearance
          </Text>
          <Pressable
            onPress={toggleTheme}
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {isDark ? (
                <Moon size={20} color={colors.icon} />
              ) : (
                <Sun size={20} color={colors.icon} />
              )}
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {isDark ? 'Dark mode' : 'Light mode'}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>Tap to switch</Text>
          </Pressable>
        </View>

        {/* Profile Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Profile
          </Text>

          {/* Email (read-only) */}
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Email</Text>
            <Text style={{ color: colors.text, fontSize: 16 }}>{user?.email}</Text>
          </View>

          {/* Display Name (editable) */}
          <View
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
              Display Name
            </Text>
            {isEditingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  onSubmitEditing={handleSaveDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="done"
                  style={{
                    flex: 1,
                    backgroundColor: colors.bgTertiary,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
                <Pressable
                  onPress={handleSaveDisplayName}
                  disabled={isSavingName}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 6,
                    padding: 8,
                  }}
                >
                  {isSavingName ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <Check size={18} color={colors.primaryText} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDisplayName(profile?.display_name || '');
                    setIsEditingName(false);
                  }}
                  style={{ padding: 8 }}
                >
                  <X size={18} color={colors.iconMuted} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setIsEditingName(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {profile?.display_name || 'Not set'}
                </Text>
                <User size={16} color={colors.iconMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Plan Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Your Plan
          </Text>

          <Pressable
            onPress={() => setShowPlanPicker(!showPlanPicker)}
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {profile?.plan || 'free'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
                Tap to change (testing only)
              </Text>
            </View>
            <ChevronDown size={20} color={colors.iconMuted} />
          </Pressable>

          {showPlanPicker && (
            <View
              style={{
                backgroundColor: colors.bgTertiary,
                borderRadius: 8,
                marginTop: 8,
                overflow: 'hidden',
              }}
            >
              {(['free', 'starter', 'family'] as Plan[]).map((plan) => (
                <Pressable
                  key={plan}
                  onPress={() => handleChangePlan(plan)}
                  style={{
                    padding: 16,
                    backgroundColor: profile?.plan === plan ? colors.bgHover : 'transparent',
                    borderBottomWidth: plan !== 'family' ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '500',
                      textTransform: 'capitalize',
                    }}
                  >
                    {plan}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                    {PLAN_LIMITS[plan].maxNotes === null ? 'Unlimited' : PLAN_LIMITS[plan].maxNotes}{' '}
                    notes •{' '}
                    {PLAN_LIMITS[plan].maxSharedUsers === 0
                      ? 'No sharing'
                      : `Share with ${PLAN_LIMITS[plan].maxSharedUsers}`}{' '}
                    • {PLAN_LIMITS[plan].hasLiveSync ? 'Live sync' : 'No live sync'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Plan Limits */}
          <View style={{ marginTop: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color={colors.iconMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                Notes: {noteCount} / {planLimits.maxNotes ?? '∞'}
                {atNoteLimit && <Text style={{ color: colors.error }}> (limit reached)</Text>}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Users size={16} color={colors.iconMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                Sharing with: {uniqueShareCount} / {planLimits.maxSharedUsers} people
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color={planLimits.hasLiveSync ? colors.primary : colors.iconMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                Live sync: {planLimits.hasLiveSync ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>

        {/* Default Share List */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
            Auto-Share List
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>
            New notes (except private) are automatically shared with these people.
          </Text>

          {planLimits.maxSharedUsers === 0 ? (
            <View style={{ backgroundColor: colors.bgSecondary, borderRadius: 8, padding: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                Upgrade to Starter or Family to share notes
              </Text>
            </View>
          ) : (
            <>
              {/* Add new share */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  onSubmitEditing={handleAddDefaultShare}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  style={{
                    flex: 1,
                    backgroundColor: colors.bgSecondary,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
                <Pressable
                  onPress={handleAddDefaultShare}
                  disabled={isAddingShare || !newEmail.trim()}
                  style={{
                    backgroundColor: newEmail.trim() ? colors.primary : colors.bgTertiary,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                  }}
                >
                  {isAddingShare ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <Plus
                      size={20}
                      color={newEmail.trim() ? colors.primaryText : colors.iconMuted}
                    />
                  )}
                </Pressable>
              </View>

              {/* Share list */}
              {defaultShares.length === 0 ? (
                <View style={{ backgroundColor: colors.bgSecondary, borderRadius: 8, padding: 16 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                    No one in your auto-share list yet
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {defaultShares.map((share, index) => (
                    <View
                      key={share.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 12,
                        borderBottomWidth: index < defaultShares.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15 }}>
                          {share.shared_with_email}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveShare(share.id)}
                        style={{ padding: 8, marginRight: -8 }}
                      >
                        <X size={18} color={colors.iconMuted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Data Export/Import Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
            Data
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>
            Export or import your notes as markdown files.
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleExport}
              disabled={isExporting}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.bgSecondary,
                borderRadius: 8,
                paddingVertical: 12,
              }}
            >
              {isExporting ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Download size={18} color={colors.primary} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                    Export All
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleImport}
              disabled={isImporting}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.bgSecondary,
                borderRadius: 8,
                paddingVertical: 12,
              }}
            >
              {isImporting ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Upload size={18} color={colors.primary} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                    Import
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* About Section */}
        <View style={{ marginBottom: 24 }}>
          <Pressable
            onPress={() => router.push('/about')}
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>About</Text>
            <ChevronRight size={20} color={colors.iconMuted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Remove share confirmation */}
      <ConfirmDialog
        visible={removeShareConfirm !== null}
        title="Remove from auto-share?"
        message="This person will no longer receive new notes automatically. Existing shared notes are not affected."
        confirmText="Remove"
        destructive
        onConfirm={confirmRemoveShare}
        onCancel={() => setRemoveShareConfirm(null)}
      />

      {/* Import confirmation */}
      <ConfirmDialog
        visible={importConfirm !== null}
        title="Import Notes"
        message={importConfirm?.message || ''}
        confirmText="Import"
        onConfirm={confirmImport}
        onCancel={cancelImport}
      />
    </View>
  );
}
