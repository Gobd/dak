import { NoteEditor } from '@/components/NoteEditor';
import { NotesList } from '@/components/NotesList';
import { SearchBar } from '@/components/SearchBar';
import { TagsSidebarSection } from '@/components/TagChips';
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
import { useRouter } from 'expo-router';
import ArrowUpDown from 'lucide-react-native/dist/esm/icons/arrow-up-down';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react-native/dist/esm/icons/chevron-right';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import LogOut from 'lucide-react-native/dist/esm/icons/log-out';
import Menu from 'lucide-react-native/dist/esm/icons/menu';
import PanelLeft from 'lucide-react-native/dist/esm/icons/panel-left';
import PanelLeftClose from 'lucide-react-native/dist/esm/icons/panel-left-close';
import Plus from 'lucide-react-native/dist/esm/icons/plus';
import RefreshCw from 'lucide-react-native/dist/esm/icons/refresh-cw';
import Settings from 'lucide-react-native/dist/esm/icons/settings';
import Tag from 'lucide-react-native/dist/esm/icons/tag';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
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

  const handleTrashNote = async () => {
    if (!user?.id || !currentNote) return;

    // Only the owner can trash a note
    if (currentNote.user_id !== user.id) {
      showToast('You can only delete notes you own.', 'error');
      return;
    }

    // Find current index to select next note after deletion
    const currentIndex = filteredNotes.findIndex((n) => n.id === currentNote.id);
    const nextNote = filteredNotes[currentIndex + 1] || filteredNotes[currentIndex - 1] || null;
    await trashNote(currentNote.id, user.id);
    setCurrentNote(nextNote);
  };

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
          <Pressable
            onPress={toggleShowPrivate}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 4,
              paddingRight: 8,
            }}
          >
            {!showPrivate && <Lock size={16} color={colors.primary} />}
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
              {showPrivate ? 'All Notes' : 'Public'}
            </Text>
            <ChevronDown size={18} color={colors.textMuted} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Create Note Button */}
            <View style={{ position: 'relative', zIndex: 11 }}>
              <Pressable
                onPress={() => {
                  if (!showPrivate) {
                    handleCreateNote(false);
                  } else {
                    setShowMobileMenu(false);
                    setShowCreateMenu(!showCreateMenu);
                  }
                }}
                style={{ backgroundColor: colors.primary, padding: 8, borderRadius: 8 }}
              >
                <Plus size={20} color={colors.primaryText} />
              </Pressable>
              {showCreateMenu && showPrivate && (
                <View
                  style={{
                    position: 'absolute',
                    top: 44,
                    right: 0,
                    backgroundColor: colors.bgSecondary,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    minWidth: 160,
                    zIndex: 100,
                    elevation: 100,
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
            {/* Menu Button */}
            <View style={{ position: 'relative', zIndex: 10 }}>
              <Pressable
                onPress={() => {
                  setShowCreateMenu(false);
                  setShowMobileMenu(!showMobileMenu);
                }}
                style={{ padding: 8 }}
              >
                <Menu size={20} color={colors.icon} />
              </Pressable>
              {showMobileMenu && (
                <View
                  style={{
                    position: 'absolute',
                    top: 44,
                    right: 0,
                    backgroundColor: colors.bgSecondary,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    minWidth: 200,
                    maxHeight: 400,
                    zIndex: 100,
                  }}
                >
                  {/* Tags Section */}
                  <Pressable
                    onPress={() => setShowMobileTagsMenu(!showMobileTagsMenu)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Tag size={16} color={colors.icon} />
                      <Text style={{ color: colors.text, fontSize: 14 }}>
                        {selectedTagId
                          ? tags.find((t) => t.id === selectedTagId)?.name || 'Tags'
                          : 'Tags'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {selectedTagId && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedTagId(null);
                            setShowMobileTagsMenu(false);
                            setShowMobileMenu(false);
                          }}
                          style={{
                            padding: 4,
                            backgroundColor: colors.bgTertiary,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Clear</Text>
                        </Pressable>
                      )}
                      <ChevronRight
                        size={16}
                        color={colors.iconMuted}
                        style={{
                          transform: [{ rotate: showMobileTagsMenu ? '90deg' : '0deg' }],
                        }}
                      />
                    </View>
                  </Pressable>
                  {showMobileTagsMenu && (
                    <ScrollView style={{ maxHeight: 200 }}>
                      <Pressable
                        onPress={() => {
                          setSelectedTagId(null);
                          setShowMobileTagsMenu(false);
                          setShowMobileMenu(false);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          backgroundColor: !selectedTagId ? colors.bgHover : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: !selectedTagId ? colors.text : colors.textMuted,
                            fontSize: 14,
                          }}
                        >
                          All notes
                        </Text>
                      </Pressable>
                      {tags.map((tag) => (
                        <Pressable
                          key={tag.id}
                          onPress={() => {
                            setSelectedTagId(tag.id);
                            setShowMobileTagsMenu(false);
                            setShowMobileMenu(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            backgroundColor:
                              selectedTagId === tag.id ? colors.bgHover : 'transparent',
                          }}
                        >
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: tag.color || colors.primary,
                            }}
                          />
                          <Text
                            style={{
                              color: selectedTagId === tag.id ? colors.text : colors.textMuted,
                              fontSize: 14,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {tag.name}
                          </Text>
                          {tagCounts[tag.id] && (
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                              {tagCounts[tag.id]}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                  {Platform.OS === 'web' && (
                    <Pressable
                      onPress={() => {
                        setShowMobileMenu(false);
                        window.location.reload();
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <RefreshCw size={16} color={colors.icon} />
                      <Text style={{ color: colors.text, fontSize: 14 }}>Refresh</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      setShowMobileMenu(false);
                      router.push('/settings');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Settings size={16} color={colors.icon} />
                    <Text style={{ color: colors.text, fontSize: 14 }}>Settings</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowMobileMenu(false);
                      router.push('/trash');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Trash2 size={16} color={colors.icon} />
                    <Text style={{ color: colors.text, fontSize: 14 }}>Trash</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowMobileMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}
                  >
                    <LogOut size={16} color={colors.error} />
                    <Text style={{ color: colors.error, fontSize: 14 }}>Log out</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>
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
        <View
          style={{
            width: 224,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            flexDirection: 'column',
          }}
        >
          {/* Nav Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>SimpleNotes</Text>
            <Pressable onPress={() => setShowNavSidebar(false)} style={{ padding: 4 }}>
              <PanelLeftClose size={18} color={colors.iconMuted} />
            </Pressable>
          </View>

          {/* Tags */}
          <ScrollView style={{ flex: 1 }}>
            <View style={{ paddingVertical: 8 }}>
              <TagsSidebarSection
                tags={tags}
                selectedTagId={selectedTagId}
                onSelectTag={setSelectedTagId}
                tagCounts={tagCounts}
              />
            </View>
          </ScrollView>

          {/* Sidebar Footer */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12 }}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => window.location.reload()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <RefreshCw size={16} color={colors.iconMuted} />
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Refresh</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push('/settings')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 8,
              }}
            >
              <Settings size={16} color={colors.iconMuted} />
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Settings</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/trash')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 8,
              }}
            >
              <Trash2 size={16} color={colors.iconMuted} />
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Trash</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowLogoutConfirm(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 8,
              }}
            >
              <LogOut size={16} color={colors.iconMuted} />
              <Text style={{ color: colors.textTertiary, fontSize: 14 }} numberOfLines={1}>
                {user?.email}
              </Text>
            </Pressable>
          </View>
        </View>
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
    </View>
  );
}
