import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Moon,
  Plus,
  Sun,
  Upload,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import type { Plan } from '../constants/plan-limits';
import { PLAN_LIMITS } from '../constants/plan-limits';
import { notesApi } from '../lib/api/notes';
import { sharesApi } from '../lib/api/shares';
import { exportNotesAsZip } from '../lib/export-notes';
import { importNotesFromFiles } from '../lib/import-notes';
import { useAuthStore } from '../stores/auth-store';
import { useNotesStore } from '../stores/notes-store';
import { useSharesStore } from '../stores/shares-store';
import { useTagsStore } from '../stores/tags-store';
import { useThemeStore } from '../stores/theme-store';
import { useToastStore } from '../stores/toast-store';
import { useUserStore } from '../stores/user-store';

export function Settings() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
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
        'error',
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
            'error',
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
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Link to="/" className="p-2 -ml-2">
          <ArrowLeft size={20} className="text-zinc-500" />
        </Link>
        <span className="text-lg font-semibold ml-2 text-zinc-950 dark:text-white">Settings</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Appearance Section */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-zinc-950 dark:text-white">Appearance</h2>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800"
          >
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon size={20} className="text-zinc-500" />
              ) : (
                <Sun size={20} className="text-zinc-500" />
              )}
              <span className="text-base text-zinc-950 dark:text-white">
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
            </div>
            <span className="text-sm text-zinc-500">Tap to switch</span>
          </button>
        </div>

        {/* Profile Section */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-zinc-950 dark:text-white">Profile</h2>

          {/* Email (read-only) */}
          <div className="rounded-lg p-3 mb-2 bg-zinc-100 dark:bg-zinc-800">
            <span className="block text-xs mb-1 text-zinc-500">Email</span>
            <span className="block text-base text-zinc-950 dark:text-white">{user?.email}</span>
          </div>

          {/* Display Name (editable) */}
          <div className="rounded-lg p-3 bg-zinc-100 dark:bg-zinc-800">
            <span className="block text-xs mb-1 text-zinc-500">Display Name</span>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveDisplayName()}
                  placeholder="Enter your name"
                  autoFocus
                  className="flex-1 rounded-md px-2.5 py-2 text-base outline-none bg-zinc-200 dark:bg-zinc-900 text-zinc-950 dark:text-white"
                />
                <button
                  onClick={handleSaveDisplayName}
                  disabled={isSavingName}
                  className="p-2 rounded-md bg-amber-500 dark:bg-amber-400"
                >
                  {isSavingName ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <Check size={18} className="text-black" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setDisplayName(profile?.display_name || '');
                    setIsEditingName(false);
                  }}
                  className="p-2"
                >
                  <X size={18} className="text-zinc-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="w-full flex items-center justify-between"
              >
                <span className="text-base text-zinc-950 dark:text-white">
                  {profile?.display_name || 'Not set'}
                </span>
                <User size={16} className="text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Plan Section */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-zinc-950 dark:text-white">Your Plan</h2>

          <button
            onClick={() => setShowPlanPicker(!showPlanPicker)}
            className="w-full flex items-center justify-between rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800"
          >
            <div>
              <span className="block text-lg font-semibold capitalize text-zinc-950 dark:text-white">
                {profile?.plan || 'free'}
              </span>
              <span className="block text-sm mt-1 text-zinc-500">Tap to change (testing only)</span>
            </div>
            <ChevronDown size={20} className="text-zinc-400" />
          </button>

          {showPlanPicker && (
            <div className="rounded-lg mt-2 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
              {(['free', 'starter', 'family'] as Plan[]).map((plan) => (
                <button
                  key={plan}
                  onClick={() => handleChangePlan(plan)}
                  className={`w-full p-4 text-left border-b last:border-b-0 border-zinc-200 dark:border-zinc-800 ${
                    profile?.plan === plan ? 'bg-zinc-200 dark:bg-zinc-800' : ''
                  }`}
                >
                  <span className="block text-base font-medium capitalize text-zinc-950 dark:text-white">
                    {plan}
                  </span>
                  <span className="block text-sm mt-1 text-zinc-500">
                    {PLAN_LIMITS[plan].maxNotes === null ? 'Unlimited' : PLAN_LIMITS[plan].maxNotes}{' '}
                    notes •{' '}
                    {PLAN_LIMITS[plan].maxSharedUsers === 0
                      ? 'No sharing'
                      : `Share with ${PLAN_LIMITS[plan].maxSharedUsers}`}{' '}
                    • {PLAN_LIMITS[plan].hasLiveSync ? 'Live sync' : 'No live sync'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Plan Limits */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-500">
                Notes: {noteCount} / {planLimits.maxNotes ?? '∞'}
                {atNoteLimit && <span className="text-red-500"> (limit reached)</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-500">
                Sharing with: {uniqueShareCount} / {planLimits.maxSharedUsers} people
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap
                size={16}
                className={
                  planLimits.hasLiveSync ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-400'
                }
              />
              <span className="text-sm text-zinc-500">
                Live sync: {planLimits.hasLiveSync ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Default Share List */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1 text-zinc-950 dark:text-white">
            Auto-Share List
          </h2>
          <p className="text-sm mb-3 text-zinc-500">
            New notes (except private) are automatically shared with these people.
          </p>

          {planLimits.maxSharedUsers === 0 ? (
            <div className="rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800">
              <p className="text-sm text-center text-zinc-500">
                Upgrade to Starter or Family to share notes
              </p>
            </div>
          ) : (
            <>
              {/* Add new share */}
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDefaultShare()}
                  placeholder="Email address"
                  className="flex-1 rounded-lg px-3 py-2.5 text-base outline-none bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white"
                />
                <button
                  onClick={handleAddDefaultShare}
                  disabled={isAddingShare || !newEmail.trim()}
                  className={`px-4 rounded-lg flex items-center justify-center ${
                    newEmail.trim()
                      ? 'bg-amber-500 dark:bg-amber-400'
                      : 'bg-zinc-100 dark:bg-zinc-900'
                  }`}
                >
                  {isAddingShare ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <Plus size={20} className={newEmail.trim() ? 'text-black' : 'text-zinc-400'} />
                  )}
                </button>
              </div>

              {/* Share list */}
              {defaultShares.length === 0 ? (
                <div className="rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800">
                  <p className="text-sm text-center text-zinc-500">
                    No one in your auto-share list yet
                  </p>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {defaultShares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 border-b last:border-b-0 border-zinc-200 dark:border-zinc-700"
                    >
                      <span className="text-base flex-1 text-zinc-950 dark:text-white">
                        {share.shared_with_email}
                      </span>
                      <button onClick={() => handleRemoveShare(share.id)} className="p-2 -mr-2">
                        <X size={18} className="text-zinc-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Data Export/Import Section */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1 text-zinc-950 dark:text-white">Data</h2>
          <p className="text-sm mb-3 text-zinc-500">
            Export or import your notes as markdown files.
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-3 bg-zinc-100 dark:bg-zinc-800"
            >
              {isExporting ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Download size={18} className="text-amber-500 dark:text-amber-400" />
                  <span className="text-base font-medium text-zinc-950 dark:text-white">
                    Export All
                  </span>
                </>
              )}
            </button>

            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-3 bg-zinc-100 dark:bg-zinc-800"
            >
              {isImporting ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Upload size={18} className="text-amber-500 dark:text-amber-400" />
                  <span className="text-base font-medium text-zinc-950 dark:text-white">
                    Import
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className="mb-6">
          <Link
            to="/about"
            className="flex items-center justify-between rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800"
          >
            <span className="text-base text-zinc-950 dark:text-white">About</span>
            <ChevronRight size={20} className="text-zinc-400" />
          </Link>
        </div>
      </div>

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
    </div>
  );
}
