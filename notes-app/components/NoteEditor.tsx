import { NoteSharing } from '@/components/NoteSharing';
import { RichNoteEditor, type RichNoteEditorRef } from '@/components/RichNoteEditor';
import { useTheme, useThemeColors } from '@/hooks/useThemeColors';
import { useUserStore } from '@/stores/user-store';
import type { Note, NoteUpdate } from '@/types/note';
import type { Tag } from '@/types/tag';
import { setStringAsync } from 'expo-clipboard';
import ChevronLeft from 'lucide-react-native/dist/esm/icons/chevron-left';
import Copy from 'lucide-react-native/dist/esm/icons/copy';
import Hash from 'lucide-react-native/dist/esm/icons/hash';
import Eye from 'lucide-react-native/dist/esm/icons/eye';
import EyeOff from 'lucide-react-native/dist/esm/icons/eye-off';
import Heading1 from 'lucide-react-native/dist/esm/icons/heading-1';
import Heading2 from 'lucide-react-native/dist/esm/icons/heading-2';
import Heading3 from 'lucide-react-native/dist/esm/icons/heading-3';
import List from 'lucide-react-native/dist/esm/icons/list';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import LockOpen from 'lucide-react-native/dist/esm/icons/lock-open';
import Pin from 'lucide-react-native/dist/esm/icons/pin';
import SquareCheck from 'lucide-react-native/dist/esm/icons/square-check';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2';
import X from 'lucide-react-native/dist/esm/icons/x';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

const MAX_TAG_NAME_LENGTH = 30;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

interface NoteEditorProps {
  note: Note;
  onUpdate: (updates: NoteUpdate) => void;
  onBack?: () => void;
  onTrash?: () => void;
  tags?: Tag[];
  noteTags?: Tag[];
  onAddTag?: (tagId: string) => void;
  onRemoveTag?: (tagId: string) => void;
  onCreateTag?: (name: string) => void;
}

export function NoteEditor({
  note,
  onUpdate,
  onBack,
  onTrash,
  tags = [],
  noteTags = [],
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: NoteEditorProps) {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const { planLimits } = useUserStore();
  const editorRef = useRef<RichNoteEditorRef>(null);
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;

  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const maxContentLength = planLimits.maxNoteLength;

  const handleCopyMarkdown = async () => {
    if (note.content) {
      await setStringAsync(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContentUpdate = (content: string) => {
    onUpdate({ content });
  };

  const handleCreateTag = () => {
    const trimmed = newTagName.trim();
    if (trimmed && trimmed.length <= MAX_TAG_NAME_LENGTH && onCreateTag) {
      onCreateTag(trimmed);
      setNewTagName('');
    }
  };

  const isTagNameOverLimit = newTagName.trim().length > MAX_TAG_NAME_LENGTH;
  const availableTags = tags.filter((t) => !noteTags.some((nt) => nt.id === t.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Toolbar */}
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingVertical: 8,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 8,
          }}
        >
          {/* Back Button (narrow view) */}
          {onBack && (
            <Pressable
              onPress={() => {
                // Blur the editor to dismiss virtual keyboard before unmount
                editorRef.current?.blur();
                setTimeout(onBack, 50);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                paddingRight: 8,
                marginLeft: -4,
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14 }}>Back</Text>
            </Pressable>
          )}
          {/* Pinned Toggle */}
          <Pressable
            onPress={() => onUpdate({ pinned: !note.pinned })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              flexShrink: 0,
              backgroundColor: note.pinned
                ? isDark
                  ? 'rgba(251, 191, 36, 0.2)'
                  : 'rgba(245, 158, 11, 0.15)'
                : colors.bgTertiary,
            }}
          >
            <Pin size={16} color={note.pinned ? colors.primary : colors.icon} />
            {!isNarrow && (
              <Text
                style={{ color: note.pinned ? colors.primary : colors.textTertiary, fontSize: 14 }}
              >
                {note.pinned ? 'Pinned' : 'Pin'}
              </Text>
            )}
          </Pressable>

          {/* Private Toggle */}
          <Pressable
            onPress={() => onUpdate({ is_private: !note.is_private })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              flexShrink: 0,
              backgroundColor: note.is_private
                ? colors.bgTertiary
                : isDark
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
            }}
          >
            {note.is_private ? (
              <>
                <Lock size={16} color={colors.icon} />
                {!isNarrow && (
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Private</Text>
                )}
              </>
            ) : (
              <>
                <LockOpen size={16} color={colors.success} />
                {!isNarrow && <Text style={{ color: colors.success, fontSize: 14 }}>Shared</Text>}
              </>
            )}
          </Pressable>

          {/* Separator */}
          <View
            style={{
              width: 1,
              height: 16,
              backgroundColor: colors.border,
              marginHorizontal: 4,
              flexShrink: 0,
            }}
          />

          {/* Read-only Toggle */}
          <Pressable
            onPress={() => {
              const newState = !isReadOnly;
              setIsReadOnly(newState);
              editorRef.current?.setEditable(!newState);
            }}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: isReadOnly ? colors.primary + '20' : colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            {isReadOnly ? (
              <Eye size={16} color={colors.primary} />
            ) : (
              <EyeOff size={16} color={colors.icon} />
            )}
          </Pressable>

          <View
            style={{
              width: 1,
              height: 16,
              backgroundColor: colors.border,
              marginHorizontal: 4,
              flexShrink: 0,
            }}
          />

          {/* Editor formatting buttons */}
          <Pressable
            onPress={() => editorRef.current?.toggleHeading(1)}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            <Heading1 size={16} color={colors.icon} />
          </Pressable>
          <Pressable
            onPress={() => editorRef.current?.toggleHeading(2)}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            <Heading2 size={16} color={colors.icon} />
          </Pressable>
          <Pressable
            onPress={() => editorRef.current?.toggleHeading(3)}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            <Heading3 size={16} color={colors.icon} />
          </Pressable>
          <View
            style={{
              width: 1,
              height: 16,
              backgroundColor: colors.border,
              marginHorizontal: 2,
              flexShrink: 0,
            }}
          />
          <Pressable
            onPress={() => editorRef.current?.toggleBulletList()}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            <List size={16} color={colors.icon} />
          </Pressable>
          <Pressable
            onPress={() => editorRef.current?.toggleTaskList()}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            <SquareCheck size={16} color={colors.icon} />
          </Pressable>
          <View
            style={{
              width: 1,
              height: 16,
              backgroundColor: colors.border,
              marginHorizontal: 2,
              flexShrink: 0,
            }}
          />
          <Pressable
            onPress={handleCopyMarkdown}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: copied ? colors.success + '20' : colors.bgTertiary,
              flexShrink: 0,
            }}
          >
            <Copy size={16} color={copied ? colors.success : colors.icon} />
          </Pressable>
        </ScrollView>
      </View>

      {/* Rich Text Editor */}
      <RichNoteEditor
        ref={editorRef}
        key={`${note.id}-${isDark ? 'dark' : 'light'}`}
        content={note.content || ''}
        onUpdate={handleContentUpdate}
        maxLength={maxContentLength}
        placeholder="Start writing..."
      />

      {/* Tags Section at Bottom */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        {/* Tags row with inline input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {/* Current tags */}
          {noteTags.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => onRemoveTag?.(tag.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: (tag.color || '#71717a') + '33',
              }}
            >
              <Hash size={12} color={tag.color || '#71717a'} />
              <Text style={{ fontSize: 14, color: tag.color || '#71717a' }}>{tag.name}</Text>
              <X size={12} color={tag.color || '#71717a'} />
            </Pressable>
          ))}

          {/* Inline tag input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
            <Hash
              size={12}
              color={isTagNameOverLimit ? colors.error : colors.iconMuted}
              style={{ marginRight: 4 }}
            />
            <TextInput
              value={newTagName}
              onChangeText={(text) => {
                setNewTagName(text);
                setShowTagPicker(text.length > 0);
              }}
              onFocus={() => setShowTagPicker(true)}
              onBlur={() => {
                // Delay hiding to allow clicking suggestions
                setTimeout(() => setShowTagPicker(false), 200);
              }}
              placeholder="Add tag..."
              placeholderTextColor={colors.inputPlaceholder}
              style={{
                color: isTagNameOverLimit ? colors.error : colors.inputText,
                fontSize: 14,
                minWidth: 80,
                paddingVertical: 4,
              }}
              maxLength={MAX_TAG_NAME_LENGTH + 10}
              onSubmitEditing={handleCreateTag}
            />
            {isTagNameOverLimit && (
              <Text style={{ color: colors.error, fontSize: 10, marginLeft: 4 }}>
                Max {MAX_TAG_NAME_LENGTH}
              </Text>
            )}
          </View>
        </View>

        {/* Tag suggestions dropdown */}
        {showTagPicker && availableTags.length > 0 && (
          <View
            style={{
              marginTop: 8,
              padding: 8,
              backgroundColor: colors.bgTertiary,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
              {newTagName.trim() ? 'Suggestions' : 'Available tags'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {availableTags
                .filter(
                  (tag) =>
                    !newTagName.trim() || tag.name.toLowerCase().includes(newTagName.toLowerCase())
                )
                .slice(0, 8)
                .map((tag) => (
                  <Pressable
                    key={tag.id}
                    onPress={() => {
                      onAddTag?.(tag.id);
                      setNewTagName('');
                      setShowTagPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: (tag.color || '#71717a') + '33',
                    }}
                  >
                    <Hash size={12} color={tag.color || '#71717a'} />
                    <Text style={{ fontSize: 14, color: tag.color || '#71717a' }}>{tag.name}</Text>
                  </Pressable>
                ))}
            </View>
          </View>
        )}
      </View>

      {/* Sharing Section */}
      <NoteSharing
        note={note}
        onTogglePrivate={(isPrivate) => onUpdate({ is_private: isPrivate })}
      />

      {/* Created/Updated Info + Trash */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          Created {formatDate(note.created_at)}
          {note.updated_at !== note.created_at && ` · Updated ${formatDate(note.updated_at)}`}
        </Text>
        {onTrash && (
          <Pressable onPress={onTrash} style={{ padding: 4 }}>
            <Trash2 size={16} color={colors.iconMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
