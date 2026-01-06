import { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/dist/esm/icons/arrow-left';
import RotateCcw from 'lucide-react-native/dist/esm/icons/rotate-ccw';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2';
import Clock from 'lucide-react-native/dist/esm/icons/clock';
import { useAuthStore } from '@/stores/auth-store';
import { useNotesStore } from '@/stores/notes-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getNoteTitle } from '@/types/note';
import type { Note } from '@/types/note';

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

export default function TrashScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const { trashedNotes, isLoading, fetchTrashedNotes, restoreNote, deleteNotePermanently } =
    useNotesStore();
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

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

  const renderItem = ({ item }: { item: Note }) => {
    const daysRemaining = item.trashed_at
      ? getDaysRemaining(item.trashed_at)
      : TRASH_RETENTION_DAYS;
    const isUrgent = daysRemaining <= 7;

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
        }}
      >
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '500', fontSize: 16 }} numberOfLines={1}>
            {getNoteTitle(item.content)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {item.trashed_at ? formatDate(item.trashed_at) : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={10} color={isUrgent ? colors.error : colors.iconMuted} />
              <Text style={{ fontSize: 12, color: isUrgent ? colors.error : colors.textMuted }}>
                {daysRemaining === 0 ? 'Deleting soon' : `${daysRemaining}d left`}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => handleRestore(item)}
            style={{ padding: 8, backgroundColor: colors.success, borderRadius: 8 }}
          >
            <RotateCcw size={18} color="#ffffff" />
          </Pressable>
          <Pressable
            onPress={() => setNoteToDelete(item)}
            style={{ padding: 8, backgroundColor: colors.error, borderRadius: 8 }}
          >
            <Trash2 size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    );
  };

  if (isLoading && trashedNotes.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

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
        <Pressable
          onPress={() => router.replace('/')}
          style={{ padding: 8, marginLeft: -8, marginRight: 8 }}
        >
          <ArrowLeft size={20} color={colors.icon} />
        </Pressable>
        <Trash2 size={20} color={colors.error} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>
          Trash
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 8 }}>
          ({trashedNotes.length})
        </Text>
      </View>

      {/* Content */}
      {trashedNotes.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Trash2 size={48} color={colors.borderLight} />
          <Text
            style={{ color: colors.textMuted, textAlign: 'center', fontSize: 16, marginTop: 16 }}
          >
            Trash is empty
          </Text>
          <Text
            style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 14, marginTop: 8 }}
          >
            Deleted notes will appear here
          </Text>
          <Text
            style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 12, marginTop: 16 }}
          >
            Notes in trash are automatically deleted after {TRASH_RETENTION_DAYS} days
          </Text>
        </View>
      ) : (
        <FlatList
          data={trashedNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
        />
      )}

      {/* Help text */}
      {trashedNotes.length > 0 && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
            Notes in trash are automatically deleted after {TRASH_RETENTION_DAYS} days
          </Text>
        </View>
      )}

      <ConfirmDialog
        visible={noteToDelete !== null}
        title="Delete Forever"
        message={`Are you sure you want to permanently delete "${noteToDelete ? getNoteTitle(noteToDelete.content) : ''}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </View>
  );
}
