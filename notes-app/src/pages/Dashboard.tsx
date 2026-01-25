import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Lock,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Square,
  SquareCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useToggle } from '@dak/hooks';
import { DesktopSidebar } from '../components/DesktopSidebar';
import { MobileHeader } from '../components/MobileHeader';
import { NoteEditor } from '../components/NoteEditor';
import { NotesList } from '../components/NotesList';
import { Button, ConfirmModal, SearchInput, Spinner, Chip } from '@dak/ui';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useAuthStore } from '../stores/auth-store';
import { useNotesStore } from '../stores/notes-store';
import { useTagsStore } from '../stores/tags-store';
import { useToastStore } from '../stores/toast-store';
import { useUserStore } from '../stores/user-store';
import { isPublicOnly, useViewStore } from '../stores/view-store';
import { getNoteTitle } from '../types/note';

export function Dashboard() {
  const { user, signOut } = useAuthStore();
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

  // Use window width for responsive layout
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isDesktop = windowWidth >= 768;

  // Enable realtime sync across devices (only for paid plans)
  useRealtimeSync(user?.id, planLimits.hasLiveSync);

  const [showSidebar, setShowSidebar] = useState(true);
  const [showNavSidebar, setShowNavSidebar] = useState(true);
  const [showNotesSidebar, setShowNotesSidebar] = useState(true);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const showSortMenu = useToggle(false);
  const showCreateMenu = useToggle(false);
  const showMobileMenu = useToggle(false);
  const showMobileTagsMenu = useToggle(false);
  const showLogoutConfirm = useToggle(false);
  const showDeleteConfirm = useToggle(false);

  // Selection mode for bulk delete
  const isSelectionMode = useToggle(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const showBulkDeleteConfirm = useToggle(false);

  // Fetch notes, tags, and profile on mount
  useEffect(() => {
    if (user?.id) {
      fetchNotes(user.id);
      fetchTags(user.id);
      fetchAllNoteTags(user.id);
      fetchProfile(user.id);
    }
  }, [user?.id, fetchNotes, fetchTags, fetchAllNoteTags, fetchProfile]);

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

  const handleCreateNote = async (isPrivate: boolean = false) => {
    if (!user?.id) return;
    showCreateMenu.setFalse();
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

    showDeleteConfirm.setTrue();
  };

  const handleConfirmTrash = async () => {
    if (!user?.id || !currentNote) return;

    await trashNote(currentNote.id, user.id);
    showDeleteConfirm.setFalse();
    setCurrentNote(null);
    // On mobile, return to list view
    if (!isDesktop) {
      setShowSidebar(true);
    }
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

    showBulkDeleteConfirm.setFalse();
    exitSelectionMode();
    setCurrentNote(null);
  };

  // Check if all owned notes are selected
  const ownedNoteIds = filteredNotes.filter((n) => n.user_id === user?.id).map((n) => n.id);
  const allOwnedSelected =
    ownedNoteIds.length > 0 && ownedNoteIds.every((id) => selectedNoteIds.has(id));

  const handleSelectNote = (note: typeof currentNote) => {
    setCurrentNote(note);
    showCreateMenu.setFalse();
    showMobileMenu.setFalse();
    if (!isDesktop) {
      setShowSidebar(false);
    }
  };

  const handleBack = () => {
    setCurrentNote(null);
    setShowSidebar(true);
  };

  if (isLoading && notes.length === 0) {
    return <Spinner size="lg" fullScreen />;
  }

  // Mobile: show either list or editor
  if (!isDesktop) {
    if (currentNote && !showSidebar) {
      return (
        <div className="h-screen flex flex-col overflow-hidden bg-surface">
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
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen relative bg-surface">
        {/* Backdrop to close menus when tapping outside */}
        {(showMobileMenu.value || showSortMenu.value || showCreateMenu.value) && (
          <div
            onClick={() => {
              showMobileMenu.setFalse();
              showMobileTagsMenu.setFalse();
              showSortMenu.setFalse();
              showCreateMenu.setFalse();
            }}
            className="absolute inset-0 z-[5]"
          />
        )}
        {/* Mobile Header */}
        <MobileHeader
          isSelectionMode={isSelectionMode.value}
          allOwnedSelected={allOwnedSelected}
          selectedNoteIds={selectedNoteIds}
          toggleSelectAll={toggleSelectAll}
          onBulkDelete={() => showBulkDeleteConfirm.setTrue()}
          exitSelectionMode={exitSelectionMode}
          enterSelectionMode={enterSelectionMode}
          showPrivate={showPrivate}
          toggleShowPrivate={toggleShowPrivate}
          isPublicOnly={isPublicOnly}
          showCreateMenu={showCreateMenu.value}
          setShowCreateMenu={showCreateMenu.set}
          onCreateNote={handleCreateNote}
          showMobileMenu={showMobileMenu.value}
          setShowMobileMenu={showMobileMenu.set}
          tags={tags}
          selectedTagId={selectedTagId}
          setSelectedTagId={setSelectedTagId}
          tagCounts={tagCounts}
          showMobileTagsMenu={showMobileTagsMenu.value}
          setShowMobileTagsMenu={showMobileTagsMenu.set}
          onLogout={() => showLogoutConfirm.setTrue()}
        />
        {/* Mobile Search */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search notes..."
          className="mx-4 my-2"
        />
        {/* Active Tag Filter */}
        {selectedTagId && (
          <Chip
            size="sm"
            color={tags.find((t) => t.id === selectedTagId)?.color || '#f59e0b'}
            onRemove={() => setSelectedTagId(null)}
            className="mx-4 mt-2 self-start"
          >
            {tags.find((t) => t.id === selectedTagId)?.name}
          </Chip>
        )}
        {/* Mobile Sort Options */}
        <div className="px-4 py-2 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => showSortMenu.toggle()}
            className="flex items-center gap-1 p-0"
          >
            <ArrowUpDown size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">
              {sortBy === 'updated'
                ? 'Last updated'
                : sortBy === 'created'
                  ? 'Date created'
                  : 'Title'}
            </span>
          </Button>
          {showSortMenu.value && (
            <div className="mt-2 rounded-lg overflow-hidden bg-surface-sunken">
              {(['updated', 'created', 'title'] as const).map((option) => (
                <Button
                  key={option}
                  variant="ghost"
                  onClick={() => {
                    setSortBy(option);
                    showSortMenu.setFalse();
                  }}
                  className={`w-full px-3 py-2 text-left rounded-none justify-start ${
                    sortBy === option ? 'bg-surface-sunken' : ''
                  }`}
                >
                  <span
                    className={`text-sm ${sortBy === option ? 'text-text' : 'text-text-muted'}`}
                  >
                    {option === 'updated'
                      ? 'Last updated'
                      : option === 'created'
                        ? 'Date created'
                        : 'Title (A-Z)'}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>
        <NotesList
          notes={filteredNotes}
          selectedNoteId={currentNote?.id || null}
          onSelectNote={handleSelectNote}
          emptyStateType={emptyStateType}
          searchQuery={searchQuery}
          selectionMode={isSelectionMode.value}
          selectedIds={selectedNoteIds}
          onToggleSelect={toggleNoteSelection}
          currentUserId={user?.id}
        />
        <ConfirmModal
          open={showLogoutConfirm.value}
          title="Log out"
          message="Are you sure you want to log out?"
          confirmText="Log out"
          variant="danger"
          onConfirm={() => {
            showLogoutConfirm.setFalse();
            signOut();
          }}
          onClose={() => showLogoutConfirm.setFalse()}
        />
        <ConfirmModal
          open={showDeleteConfirm.value}
          title="Delete note?"
          message="This will move the note to trash."
          confirmText="Delete"
          variant="danger"
          onConfirm={handleConfirmTrash}
          onClose={() => showDeleteConfirm.setFalse()}
        />
        <ConfirmModal
          open={showBulkDeleteConfirm.value}
          title={`Delete ${selectedNoteIds.size} notes?`}
          message={`This will move ${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'} to trash.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={handleBulkTrash}
          onClose={() => showBulkDeleteConfirm.setFalse()}
        />
      </div>
    );
  }

  // Desktop: side-by-side layout
  return (
    <div className="flex h-screen overflow-hidden relative bg-surface">
      {/* Backdrop to close menus when clicking/tapping outside */}
      {(showSortMenu.value || showCreateMenu.value) && (
        <div
          onClick={() => {
            showSortMenu.setFalse();
            showCreateMenu.setFalse();
          }}
          className="absolute inset-0 z-[5]"
        />
      )}
      {/* Navigation Sidebar (collapsible) */}
      {showNavSidebar && (
        <DesktopSidebar
          onClose={() => setShowNavSidebar(false)}
          tags={tags}
          selectedTagId={selectedTagId}
          onSelectTag={setSelectedTagId}
          tagCounts={tagCounts}
          userEmail={user?.email}
          onLogout={() => showLogoutConfirm.setTrue()}
        />
      )}

      {/* Notes List Sidebar (collapsible) */}
      {showNotesSidebar && (
        <div className="w-72 border-r border-border flex flex-col min-h-0 z-10">
          {/* Notes Header */}
          {isSelectionMode.value ? (
            <div className="flex items-center justify-between px-4 py-[7px] border-b z-10 border-border bg-surface-sunken">
              <Button
                variant="ghost"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 p-0"
              >
                {allOwnedSelected ? (
                  <SquareCheck size={18} className="text-warning" />
                ) : (
                  <Square size={18} className="text-text-muted" />
                )}
                <span className="text-sm text-text">All</span>
              </Button>
              <span className="text-sm font-medium text-text">{selectedNoteIds.size} selected</span>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedNoteIds.size > 0 ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={() => selectedNoteIds.size > 0 && showBulkDeleteConfirm.setTrue()}
                >
                  Delete
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={exitSelectionMode}>
                  <X size={18} className="text-text-muted" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-[7px] border-b z-10 border-border">
              {!showNavSidebar && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowNavSidebar(true)}
                  className="mr-2"
                >
                  <PanelLeft size={18} className="text-text-muted" />
                </Button>
              )}
              {selectedTagId ? (
                <span className="text-base font-medium flex-1 text-text">
                  {tags.find((t) => t.id === selectedTagId)?.name || 'Notes'}
                </span>
              ) : isPublicOnly ? (
                <span className="text-base font-medium flex-1 text-text">Notes</span>
              ) : (
                <Button
                  variant="ghost"
                  onClick={toggleShowPrivate}
                  className="flex items-center flex-1 gap-1 py-1 pr-2 p-0 justify-start"
                >
                  {!showPrivate && <Lock size={14} className="text-warning" />}
                  <span className="text-base font-medium text-text">
                    {showPrivate ? 'All Notes' : 'Public'}
                  </span>
                  <ChevronDown size={16} className="text-text-muted" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={enterSelectionMode}
                className="mr-1 shrink-0"
              >
                <SquareCheck size={18} className="text-text-muted" />
              </Button>
              <div className="relative z-10">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    // In public-only mode or kiosk mode, just create a public note directly
                    if (isPublicOnly || !showPrivate) {
                      handleCreateNote(false);
                    } else {
                      showCreateMenu.toggle();
                    }
                  }}
                  className="mr-2 bg-warning hover:bg-warning"
                >
                  <Plus size={18} className="text-black" />
                </Button>
                {showCreateMenu.value && showPrivate && !isPublicOnly && (
                  <div className="absolute top-9 right-2 rounded-lg border min-w-40 z-[100] bg-surface-sunken border-border">
                    <Button
                      variant="ghost"
                      onClick={() => handleCreateNote(false)}
                      className="flex items-center gap-2 w-full p-3 border-b border-border rounded-none justify-start"
                    >
                      <Plus size={16} className="text-text-muted" />
                      <span className="text-sm text-text">New Note</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleCreateNote(true)}
                      className="flex items-center gap-2 w-full p-3 rounded-none justify-start"
                    >
                      <Lock size={16} className="text-text-muted" />
                      <span className="text-sm text-text">Private Note</span>
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowNotesSidebar(false)}>
                <PanelLeftClose size={18} className="text-text-muted" />
              </Button>
            </div>
          )}

          {/* Desktop Search */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search notes..."
            className="mx-4 my-2"
          />

          {/* Active Tag Filter */}
          {selectedTagId && (
            <Chip
              size="sm"
              color={tags.find((t) => t.id === selectedTagId)?.color || '#f59e0b'}
              onRemove={() => setSelectedTagId(null)}
              className="mx-4 mt-2 self-start"
            >
              {tags.find((t) => t.id === selectedTagId)?.name}
            </Chip>
          )}

          {/* Sort Options */}
          <div className="px-4 py-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => showSortMenu.toggle()}
              className="flex items-center gap-1 p-0"
            >
              <ArrowUpDown size={14} className="text-text-muted" />
              <span className="text-xs text-text-muted">
                {sortBy === 'updated'
                  ? 'Last updated'
                  : sortBy === 'created'
                    ? 'Date created'
                    : 'Title'}
              </span>
            </Button>
            {showSortMenu.value && (
              <div className="mt-2 rounded-lg overflow-hidden bg-surface-sunken">
                {(['updated', 'created', 'title'] as const).map((option) => (
                  <Button
                    key={option}
                    variant="ghost"
                    onClick={() => {
                      setSortBy(option);
                      showSortMenu.setFalse();
                    }}
                    className={`w-full px-3 py-2 text-left rounded-none justify-start ${
                      sortBy === option ? 'bg-surface-sunken' : ''
                    }`}
                  >
                    <span
                      className={`text-sm ${sortBy === option ? 'text-text' : 'text-text-muted'}`}
                    >
                      {option === 'updated'
                        ? 'Last updated'
                        : option === 'created'
                          ? 'Date created'
                          : 'Title (A-Z)'}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Notes List */}
          <NotesList
            notes={filteredNotes}
            selectedNoteId={currentNote?.id || null}
            onSelectNote={handleSelectNote}
            emptyStateType={emptyStateType}
            searchQuery={searchQuery}
            selectionMode={isSelectionMode.value}
            selectedIds={selectedNoteIds}
            onToggleSelect={toggleNoteSelection}
            currentUserId={user?.id}
          />
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Always show header when sidebars are collapsed */}
        {(!showNavSidebar || !showNotesSidebar) && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              {!showNavSidebar && (
                <Button variant="secondary" size="icon-sm" onClick={() => setShowNavSidebar(true)}>
                  <PanelLeft size={18} className="text-text-muted" />
                </Button>
              )}
              {!showNotesSidebar && (
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => setShowNotesSidebar(true)}
                >
                  <PanelLeft size={18} className="text-text-muted" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!showNavSidebar && (
                <Button variant="ghost" size="icon" onClick={() => window.location.reload()}>
                  <RefreshCw size={18} className="text-text-muted" />
                </Button>
              )}
              {currentNote && (
                <Button variant="ghost" size="icon" onClick={handleTrashNote}>
                  <Trash2 size={18} className="text-text-muted" />
                </Button>
              )}
            </div>
          </div>
        )}

        {currentNote ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-base text-text-muted">Select a note or create a new one</span>
          </div>
        )}
      </div>
      <ConfirmModal
        open={showLogoutConfirm.value}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        variant="danger"
        onConfirm={() => {
          showLogoutConfirm.setFalse();
          signOut();
        }}
        onClose={() => showLogoutConfirm.setFalse()}
      />
      <ConfirmModal
        open={showDeleteConfirm.value}
        title="Delete note?"
        message="This will move the note to trash."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleConfirmTrash}
        onClose={() => showDeleteConfirm.setFalse()}
      />
      <ConfirmModal
        open={showBulkDeleteConfirm.value}
        title={`Delete ${selectedNoteIds.size} notes?`}
        message={`This will move ${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'} to trash.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleBulkTrash}
        onClose={() => showBulkDeleteConfirm.setFalse()}
      />
    </div>
  );
}
