import { View, Text, FlatList, RefreshControl } from 'react-native';
import FileText from 'lucide-react-native/dist/esm/icons/file-text';
import Search from 'lucide-react-native/dist/esm/icons/search';
import Hash from 'lucide-react-native/dist/esm/icons/hash';
import { useThemeColors } from '@/hooks/useThemeColors';
import { NoteListItem } from './NoteListItem';
import type { Note } from '@/types/note';

interface NotesListProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (note: Note) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  emptyStateType?: 'default' | 'search' | 'tag';
  searchQuery?: string;
}

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  onRefresh,
  isRefreshing,
  emptyStateType = 'default',
  searchQuery,
}: NotesListProps) {
  const colors = useThemeColors();

  if (notes.length === 0) {
    if (emptyStateType === 'search') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Search size={40} color={colors.borderLight} />
          <Text
            style={{ color: colors.textMuted, textAlign: 'center', fontSize: 16, marginTop: 16 }}
          >
            No matching notes
          </Text>
          <Text
            style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 14, marginTop: 8 }}
          >
            Try a different search term
          </Text>
        </View>
      );
    }

    if (emptyStateType === 'tag') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Hash size={40} color={colors.borderLight} />
          <Text
            style={{ color: colors.textMuted, textAlign: 'center', fontSize: 16, marginTop: 16 }}
          >
            No notes with this tag
          </Text>
          <Text
            style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 14, marginTop: 8 }}
          >
            Add this tag to notes to see them here
          </Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <FileText size={40} color={colors.borderLight} />
        <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 16, marginTop: 16 }}>
          No notes yet
        </Text>
        <Text
          style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 14, marginTop: 8 }}
        >
          Tap + to create your first note
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <NoteListItem
          note={item}
          isSelected={item.id === selectedNoteId}
          onPress={() => onSelectNote(item)}
          searchQuery={searchQuery}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 300 }}
    />
  );
}
