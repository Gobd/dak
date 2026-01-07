import { Tag as TagType } from '@/types/tag';
import { useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react-native/dist/esm/icons/chevron-right';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import LogOut from 'lucide-react-native/dist/esm/icons/log-out';
import Menu from 'lucide-react-native/dist/esm/icons/menu';
import Plus from 'lucide-react-native/dist/esm/icons/plus';
import RefreshCw from 'lucide-react-native/dist/esm/icons/refresh-cw';
import Settings from 'lucide-react-native/dist/esm/icons/settings';
import Square from 'lucide-react-native/dist/esm/icons/square';
import SquareCheck from 'lucide-react-native/dist/esm/icons/square-check';
import Tag from 'lucide-react-native/dist/esm/icons/tag';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2';
import X from 'lucide-react-native/dist/esm/icons/x';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

interface MobileHeaderProps {
  colors: {
    border: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    text: string;
    textMuted: string;
    icon: string;
    iconMuted: string;
    primary: string;
    primaryText: string;
    error: string;
  };
  // Selection mode
  isSelectionMode: boolean;
  allOwnedSelected: boolean;
  selectedNoteIds: Set<string>;
  toggleSelectAll: () => void;
  onBulkDelete: () => void;
  exitSelectionMode: () => void;
  enterSelectionMode: () => void;
  // View toggle
  showPrivate: boolean;
  toggleShowPrivate: () => void;
  // Create menu
  showCreateMenu: boolean;
  setShowCreateMenu: (show: boolean) => void;
  onCreateNote: (isPrivate: boolean) => void;
  // Mobile menu
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
  // Tags
  tags: TagType[];
  selectedTagId: string | null;
  setSelectedTagId: (id: string | null) => void;
  tagCounts: Record<string, number>;
  showMobileTagsMenu: boolean;
  setShowMobileTagsMenu: (show: boolean) => void;
  // Logout
  onLogout: () => void;
}

export function MobileHeader({
  colors,
  isSelectionMode,
  allOwnedSelected,
  selectedNoteIds,
  toggleSelectAll,
  onBulkDelete,
  exitSelectionMode,
  enterSelectionMode,
  showPrivate,
  toggleShowPrivate,
  showCreateMenu,
  setShowCreateMenu,
  onCreateNote,
  showMobileMenu,
  setShowMobileMenu,
  tags,
  selectedTagId,
  setSelectedTagId,
  tagCounts,
  showMobileTagsMenu,
  setShowMobileTagsMenu,
  onLogout,
}: MobileHeaderProps) {
  const router = useRouter();

  if (isSelectionMode) {
    return (
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
            <SquareCheck size={20} color={colors.primary} />
          ) : (
            <Square size={20} color={colors.iconMuted} />
          )}
          <Text style={{ color: colors.text, fontSize: 14 }}>All</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
          {selectedNoteIds.size} selected
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => selectedNoteIds.size > 0 && onBulkDelete()}
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
            <X size={20} color={colors.icon} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
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
                onCreateNote(false);
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
                onPress={() => onCreateNote(false)}
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
                onPress={() => onCreateNote(true)}
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
                        backgroundColor: selectedTagId === tag.id ? colors.bgHover : 'transparent',
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
                  enterSelectionMode();
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
                <SquareCheck size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontSize: 14 }}>Select</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowMobileMenu(false);
                  onLogout();
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
  );
}
