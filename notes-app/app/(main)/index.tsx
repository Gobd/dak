import { DesktopSidebar } from '@/components/DesktopSidebar';
import { MobileHeader } from '@/components/MobileHeader';
import { NoteEditor } from '@/components/NoteEditor';
import { NotesList } from '@/components/NotesList';
import { SearchBar } from '@/components/SearchBar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/stores/auth-store';
import { useNotesStore } from '@/stores/notes-store';
import { useTagsStore } from '@/stores/tags-store';
import { useToastStore } from '@/stores/toast-store';
import { useUserStore } from '@/stores/user-store';
import { useViewStore } from '@/stores/view-store';
import { getNoteTitle } from '@/types/note';
import ArrowUpDown from 'lucide-react-native/dist/esm/icons/arrow-up-down';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import PanelLeft from 'lucide-react-native/dist/esm/icons/panel-left';
import PanelLeftClose from 'lucide-react-native/dist/esm/icons/panel-left-close';
import Plus from 'lucide-react-native/dist/esm/icons/plus';
import RefreshCw from 'lucide-react-native/dist/esm/icons/refresh-cw';
import Square from 'lucide-react-native/dist/esm/icons/square';
import SquareCheck from 'lucide-react-native/dist/esm/icons/square-check';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2';
import X from 'lucide-react-native/dist/esm/icons/x';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

export default function HomeScreen() {
  const { user, signOut } = useAuthStore();
  const colors = useThemeColors();
  const { showPrivate, toggleShowPrivate, sortBy, setSortBy } = useViewStore();
  const {
    notes,
    currentNote,
    isLoading,
    fetchNotes,
    createNote,
    updateNote,
    setCurrentNote,
    trashNote,
  } = useNotesStore();

  const {
    tags,
    fetchTags,
    fetchAllNoteTags,
    createTag,
    noteTagsMap,
    addTagToNote,
    removeTagFromNote,
  } = useTagsStore();

  const { planLimits, fetchProfile } = useUserStore();
  const { showToast } = useToastStore();

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Enable realtime sync across devices (only for paid plans)
  useRealtimeSync(user?.id, planLimits.hasLiveSync);

  const [showSidebar, setShowSidebar] = useState(true);
  const [showNavSidebar, setShowNavSidebar] = useState(true);
  const [showNotesSidebar, setShowNotesSidebar] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileTagsMenu, setShowMobileTagsMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Selection mode for bulk delete
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Fetch notes, tags, and profile on mount
  useEffect(() => {
    if (user?.id) {
      fetchNotes(user.id);
      fetchTags(user.id);
      fetchAllNoteTags(user.id);
      fetchProfile(user.id);
    }
  }, [user?.id, fetchNotes, fetchTags, fetchAllNoteTags, fetchProfile]);

  // Note: fetchTagsForNote removed - fetchAllNoteTags on mount provides all mappings

  // Get tags for current note (reactive)
  const currentNoteId = currentNote?.id;
  const currentNoteTags = useMemo(() => {
    if (!currentNoteId) return [];
    const tagIds = noteTagsMap[currentNoteId] || [];
    return tags.filter((t) => tagIds.includes(t.id));
  }, [currentNoteId, noteTagsMap, tags]);

  // Calculate tag counts for sidebar (only from active notes)
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeNoteIds = new Set(notes.map((n) => n.id));
    Object.entries(noteTagsMap).forEach(([noteId, tagIds]) => {
      // Only count tags from notes that are in the active notes list
      if (activeNoteIds.has(noteId)) {
        tagIds.forEach((tagId) => {
          counts[tagId] = (counts[tagId] || 0) + 1;
        });
      }
    });
    return counts;
  }, [noteTagsMap, notes]);

  // Filter notes by tag and search query, sort pinned first
  const filteredNotes = useMemo(() => {
    let filtered = notes;

    // Filter out private notes when showPrivate is false
    if (!showPrivate) {
      filtered = filtered.filter((n) => !n.is_private);
    }

    // Filter by tag
    if (selectedTagId) {
      const noteIdsWithTag = new Set<string>();
      Object.entries(noteTagsMap).forEach(([noteId, tagIds]) => {
        if (tagIds.includes(selectedTagId)) {
          noteIdsWithTag.add(noteId);
        }
      });
      filtered = filtered.filter((n) => noteIdsWithTag.has(n.id));
    }

    // Filter by search query (content and tags)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((n) => {
        const contentMatch = n.content?.toLowerCase().includes(query);
        const noteTagIds = noteTagsMap[n.id] || [];
        const tagMatch = noteTagIds.some((tagId) => {
          const tag = tags.find((t) => t.id === tagId);
          return tag?.name.toLowerCase().includes(query);
        });
        return contentMatch || tagMatch;
      });
    }

    // Sort: pinned first, then by selected sort option
    return [...filtered].sort((a, b) => {
      // Pinned always first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Then apply selected sort
      switch (sortBy) {
        case 'title': {
          const titleA = getNoteTitle(a.content).toLowerCase();
          const titleB = getNoteTitle(b.content).toLowerCase();
          return titleA.localeCompare(titleB);
        }
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [notes, selectedTagId, noteTagsMap, tags, searchQuery, sortBy, showPrivate]);

  // Auto-select first note when notes load and no note is selected
  useEffect(() => {
    if (!isLoading && !currentNote && filteredNotes.length > 0) {
      setCurrentNote(filteredNotes[0]);
    }
  }, [isLoading, currentNote, filteredNotes, setCurrentNote]);

  // Determine empty state type
  const emptyStateType = useMemo(() => {
    if (searchQuery.trim()) return 'search' as const;
    if (selectedTagId) return 'tag' as const;
    return 'default' as const;
  }, [searchQuery, selectedTagId]);

  const handleRefresh = async () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    await fetchNotes(user.id);
    setIsRefreshing(false);
  };

  const handleCreateNote = async (isPrivate: boolean = false) => {
    if (!user?.id) return;
    setShowCreateMenu(false);
    await createNote(user.id, isPrivate);
    // On mobile, navigate to the new note by hiding sidebar
    if (!isDesktop) {
      setShowSidebar(false);
    }
  };

  const handleCreateTag = async (name: string, color?: string) => {
    if (!user?.id) return;
    const randomColors = [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#14b8a6',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ];
    const newTag = await createTag({
      user_id: user.id,
      name,
      color: color || randomColors[Math.floor(Math.random() * randomColors.length)],
    });
    return newTag;
  };

  const handleCreateAndAddTag = async (name: string) => {
    if (!user?.id || !currentNote) return;
    const newTag = await handleCreateTag(name);
    if (newTag) {
      await addTagToNote(currentNote.id, newTag.id);
    }
  };

  const handleTrashNote = () => {
    if (!user?.id || !currentNote) return;

    // Only the owner can trash a note
    if (currentNote.user_id !== user.id) {
      showToast('You can only delete notes you own.', 'error');
      return;
    }

    setShowDeleteConfirm(true);
  };

  const handleConfirmTrash = async () => {
    if (!user?.id || !currentNote) return;

    await trashNote(currentNote.id, user.id);
    setShowDeleteConfirm(false);
    setCurrentNote(null);
    // On mobile, return to list view
    if (!isDesktop) {
      setShowSidebar(true);
    }
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
    // Get only user-owned notes that can be deleted
    const ownedNoteIds = filteredNotes.filter((n) => n.user_id === user?.id).map((n) => n.id);
    const allSelected = ownedNoteIds.every((id) => selectedNoteIds.has(id));
    if (allSelected) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(ownedNoteIds));
    }
  };

  const handleBulkTrash = async () => {
    if (!user?.id || selectedNoteIds.size === 0) return;

    // Trash all selected notes
    for (const noteId of selectedNoteIds) {
      await trashNote(noteId, user.id);
    }

    setShowBulkDeleteConfirm(false);
    exitSelectionMode();
    setCurrentNote(null);
  };

  // Check if all owned notes are selected
  const ownedNoteIds = filteredNotes.filter((n) => n.user_id === user?.id).map((n) => n.id);
  const allOwnedSelected =
    ownedNoteIds.length > 0 && ownedNoteIds.every((id) => selectedNoteIds.has(id));

  const handleSelectNote = (note: typeof currentNote) => {
    setCurrentNote(note);
    setShowCreateMenu(false);
    setShowMobileMenu(false);
    if (!isDesktop) {
      setShowSidebar(false);
    }
  };

  const handleBack = () => {
    // Note: NoteEditor's Back button now calls editorRef.blur() before this
    // to properly dismiss virtual keyboard in iframe
    setCurrentNote(null);
    setShowSidebar(true);
  };

  if (isLoading && notes.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  // Mobile: show either list or editor
  if (!isDesktop) {
    if (currentNote && !showSidebar) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onUpdate={(updates) => updateNote(currentNote.id, updates)}
            onBack={handleBack}
            onTrash={handleTrashNote}
            tags={tags}
            noteTags={currentNoteTags}
            onAddTag={(tagId) => addTagToNote(currentNote.id, tagId)}
            onRemoveTag={(tagId) => removeTagFromNote(currentNote.id, tagId)}
            onCreateTag={handleCreateAndAddTag}
          />
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Backdrop to close menus when tapping outside */}
        {(showMobileMenu || showSortMenu || showCreateMenu) && (
          <Pressable
            onPress={() => {
              setShowMobileMenu(false);
              setShowMobileTagsMenu(false);
              setShowSortMenu(false);
              setShowCreateMenu(false);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 5,
            }}
            accessible={false}
          />
        )}
        {/* Mobile Header */}
        <MobileHeader
          colors={colors}
          isSelectionMode={isSelectionMode}
          allOwnedSelected={allOwnedSelected}
          selectedNoteIds={selectedNoteIds}
          toggleSelectAll={toggleSelectAll}
          onBulkDelete={() => setShowBulkDeleteConfirm(true)}
          exitSelectionMode={exitSelectionMode}
          enterSelectionMode={enterSelectionMode}
          showPrivate={showPrivate}
          toggleShowPrivate={toggleShowPrivate}
          showCreateMenu={showCreateMenu}
          setShowCreateMenu={setShowCreateMenu}
          onCreateNote={handleCreateNote}
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          tags={tags}
          selectedTagId={selectedTagId}
          setSelectedTagId={setSelectedTagId}
          tagCounts={tagCounts}
          showMobileTagsMenu={showMobileTagsMenu}
          setShowMobileTagsMenu={setShowMobileTagsMenu}
          onLogout={() => setShowLogoutConfirm(true)}
        />
        {/* Mobile Search */}
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        {/* Active Tag Filter */}
        {selectedTagId && (
          <Pressable
            onPress={() => setSelectedTagId(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginHorizontal: 16,
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: colors.bgTertiary,
              borderRadius: 16,
              alignSelf: 'flex-start',
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: tags.find((t) => t.id === selectedTagId)?.color || colors.primary,
              }}
            />
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {tags.find((t) => t.id === selectedTagId)?.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 2 }}>×</Text>
          </Pressable>
        )}
        {/* Mobile Sort Options */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => setShowSortMenu(!showSortMenu)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <ArrowUpDown size={14} color={colors.iconMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {sortBy === 'updated'
                ? 'Last updated'
                : sortBy === 'created'
                  ? 'Date created'
                  : 'Title'}
            </Text>
          </Pressable>
          {showSortMenu && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: colors.bgTertiary,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {(['updated', 'created', 'title'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    setSortBy(option);
                    setShowSortMenu(false);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: sortBy === option ? colors.bgHover : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: sortBy === option ? colors.text : colors.textTertiary,
                    }}
                  >
                    {option === 'updated'
                      ? 'Last updated'
                      : option === 'created'
                        ? 'Date created'
                        : 'Title (A-Z)'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <NotesList
          notes={filteredNotes}
          selectedNoteId={currentNote?.id || null}
          onSelectNote={handleSelectNote}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          emptyStateType={emptyStateType}
          searchQuery={searchQuery}
          selectionMode={isSelectionMode}
          selectedIds={selectedNoteIds}
          onToggleSelect={toggleNoteSelection}
          currentUserId={user?.id}
        />
        <ConfirmDialog
          visible={showLogoutConfirm}
          title="Log out"
          message="Are you sure you want to log out?"
          confirmText="Log out"
          destructive
          onConfirm={() => {
            setShowLogoutConfirm(false);
            signOut();
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
        <ConfirmDialog
          visible={showDeleteConfirm}
          title="Delete note?"
          message="This will move the note to trash."
          confirmText="Delete"
          destructive
          onConfirm={handleConfirmTrash}
          onCancel={() => setShowDeleteConfirm(false)}
        />
        <ConfirmDialog
          visible={showBulkDeleteConfirm}
          title={`Delete ${selectedNoteIds.size} notes?`}
          message={`This will move ${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'} to trash.`}
          confirmText="Delete"
          destructive
          onConfirm={handleBulkTrash}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      </View>
    );
  }

  // Desktop: side-by-side layout
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      {/* Backdrop to close menus when clicking/tapping outside */}
      {(showSortMenu || showCreateMenu) && (
        <Pressable
          onPress={() => {
            setShowSortMenu(false);
            setShowCreateMenu(false);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5,
          }}
          accessible={false}
        />
      )}
      {/* Navigation Sidebar (collapsible) */}
      {showNavSidebar && (
        <DesktopSidebar
          colors={colors}
          onClose={() => setShowNavSidebar(false)}
          tags={tags}
          selectedTagId={selectedTagId}
          onSelectTag={setSelectedTagId}
          tagCounts={tagCounts}
          userEmail={user?.email}
          onLogout={() => setShowLogoutConfirm(true)}
        />
      )}

      {/* Notes List Sidebar (collapsible) */}
      {showNotesSidebar && (
        <View
          style={{
            width: 288,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            flexDirection: 'column',
          }}
        >
          {/* Notes Header */}
          {isSelectionMode ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.bgSecondary,
                zIndex: 10,
              }}
            >
              <Pressable
                onPress={toggleSelectAll}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {allOwnedSelected ? (
                  <SquareCheck size={18} color={colors.primary} />
                ) : (
                  <Square size={18} color={colors.iconMuted} />
                )}
                <Text style={{ color: colors.text, fontSize: 14 }}>All</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                {selectedNoteIds.size} selected
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => selectedNoteIds.size > 0 && setShowBulkDeleteConfirm(true)}
                  style={{
                    backgroundColor: selectedNoteIds.size > 0 ? colors.error : colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: selectedNoteIds.size > 0 ? '#fff' : colors.textMuted,
                      fontSize: 14,
                      fontWeight: '500',
                    }}
                  >
                    Delete
                  </Text>
                </Pressable>
                <Pressable onPress={exitSelectionMode} style={{ padding: 4 }}>
                  <X size={18} color={colors.icon} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                zIndex: 10,
              }}
            >
              {!showNavSidebar && (
                <Pressable
                  onPress={() => setShowNavSidebar(true)}
                  style={{ padding: 4, marginRight: 8 }}
                >
                  <PanelLeft size={18} color={colors.iconMuted} />
                </Pressable>
              )}
              {selectedTagId ? (
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500', flex: 1 }}>
                  {tags.find((t) => t.id === selectedTagId)?.name || 'Notes'}
                </Text>
              ) : (
                <Pressable
                  onPress={toggleShowPrivate}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    gap: 4,
                    paddingVertical: 4,
                    paddingRight: 8,
                  }}
                >
                  {!showPrivate && <Lock size={14} color={colors.primary} />}
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                    {showPrivate ? 'All Notes' : 'Public'}
                  </Text>
                  <ChevronDown size={16} color={colors.textMuted} />
                </Pressable>
              )}
              <Pressable onPress={enterSelectionMode} style={{ padding: 6, marginRight: 4 }}>
                <SquareCheck size={18} color={colors.iconMuted} />
              </Pressable>
              <View style={{ position: 'relative', zIndex: 10 }}>
                <Pressable
                  onPress={() => {
                    // In public-only mode, just create a public note directly
                    if (!showPrivate) {
                      handleCreateNote(false);
                    } else {
                      setShowCreateMenu(!showCreateMenu);
                    }
                  }}
                  style={{
                    backgroundColor: colors.primary,
                    padding: 6,
                    borderRadius: 6,
                    marginRight: 8,
                  }}
                >
                  <Plus size={18} color={colors.primaryText} />
                </Pressable>
                {showCreateMenu && showPrivate && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 36,
                      right: 8,
                      backgroundColor: colors.bgSecondary,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      minWidth: 160,
                      zIndex: 100,
                    }}
                  >
                    <Pressable
                      onPress={() => handleCreateNote(false)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Plus size={16} color={colors.icon} />
                      <Text style={{ color: colors.text, fontSize: 14 }}>New Note</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleCreateNote(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}
                    >
                      <Lock size={16} color={colors.icon} />
                      <Text style={{ color: colors.text, fontSize: 14 }}>Private Note</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <Pressable onPress={() => setShowNotesSidebar(false)} style={{ padding: 4 }}>
                <PanelLeftClose size={18} color={colors.iconMuted} />
              </Pressable>
            </View>
          )}

          {/* Desktop Search */}
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

          {/* Active Tag Filter */}
          {selectedTagId && (
            <Pressable
              onPress={() => setSelectedTagId(null)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginHorizontal: 16,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: colors.bgTertiary,
                borderRadius: 16,
                alignSelf: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    tags.find((t) => t.id === selectedTagId)?.color || colors.primary,
                }}
              />
              <Text style={{ color: colors.text, fontSize: 13 }}>
                {tags.find((t) => t.id === selectedTagId)?.name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 2 }}>×</Text>
            </Pressable>
          )}

          {/* Sort Options */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => setShowSortMenu(!showSortMenu)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <ArrowUpDown size={14} color={colors.iconMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {sortBy === 'updated'
                  ? 'Last updated'
                  : sortBy === 'created'
                    ? 'Date created'
                    : 'Title'}
              </Text>
            </Pressable>
            {showSortMenu && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: colors.bgTertiary,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {(['updated', 'created', 'title'] as const).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setSortBy(option);
                      setShowSortMenu(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: sortBy === option ? colors.bgHover : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: sortBy === option ? colors.text : colors.textTertiary,
                      }}
                    >
                      {option === 'updated'
                        ? 'Last updated'
                        : option === 'created'
                          ? 'Date created'
                          : 'Title (A-Z)'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Notes List */}
          <NotesList
            notes={filteredNotes}
            selectedNoteId={currentNote?.id || null}
            onSelectNote={handleSelectNote}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            emptyStateType={emptyStateType}
            searchQuery={searchQuery}
            selectionMode={isSelectionMode}
            selectedIds={selectedNoteIds}
            onToggleSelect={toggleNoteSelection}
            currentUserId={user?.id}
          />
        </View>
      )}

      {/* Editor Area */}
      <View style={{ flex: 1 }}>
        {/* Always show header when sidebars are collapsed */}
        {(!showNavSidebar || !showNotesSidebar) && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!showNavSidebar && (
                <Pressable
                  onPress={() => setShowNavSidebar(true)}
                  style={{ padding: 6, backgroundColor: colors.bgTertiary, borderRadius: 4 }}
                >
                  <PanelLeft size={18} color={colors.iconMuted} />
                </Pressable>
              )}
              {!showNotesSidebar && (
                <Pressable
                  onPress={() => setShowNotesSidebar(true)}
                  style={{ padding: 6, backgroundColor: colors.bgTertiary, borderRadius: 4 }}
                >
                  <PanelLeft size={18} color={colors.icon} />
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {Platform.OS === 'web' && !showNavSidebar && (
                <Pressable onPress={() => window.location.reload()} style={{ padding: 8 }}>
                  <RefreshCw size={18} color={colors.iconMuted} />
                </Pressable>
              )}
              {currentNote && (
                <Pressable onPress={handleTrashNote} style={{ padding: 8 }}>
                  <Trash2 size={18} color={colors.iconMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {currentNote ? (
          <View style={{ flex: 1 }}>
            <NoteEditor
              key={currentNote.id}
              note={currentNote}
              onUpdate={(updates) => updateNote(currentNote.id, updates)}
              onTrash={handleTrashNote}
              tags={tags}
              noteTags={currentNoteTags}
              onAddTag={(tagId) => addTagToNote(currentNote.id, tagId)}
              onRemoveTag={(tagId) => removeTagFromNote(currentNote.id, tagId)}
              onCreateTag={handleCreateAndAddTag}
            />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>
              Select a note or create a new one
            </Text>
          </View>
        )}
      </View>
      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        destructive
        onConfirm={() => {
          setShowLogoutConfirm(false);
          signOut();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete note?"
        message="This will move the note to trash."
        confirmText="Delete"
        destructive
        onConfirm={handleConfirmTrash}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        visible={showBulkDeleteConfirm}
        title={`Delete ${selectedNoteIds.size} notes?`}
        message={`This will move ${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'} to trash.`}
        confirmText="Delete"
        destructive
        onConfirm={handleBulkTrash}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </View>
  );
}
