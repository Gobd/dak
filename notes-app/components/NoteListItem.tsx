import { View, Text, Pressable } from 'react-native';
import Pin from 'lucide-react-native/dist/esm/icons/pin';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import Users from 'lucide-react-native/dist/esm/icons/users';
import CircleUser from 'lucide-react-native/dist/esm/icons/circle-user';
import SquareCheck from 'lucide-react-native/dist/esm/icons/square-check';
import Square from 'lucide-react-native/dist/esm/icons/square';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimestampRefresh } from '@/hooks/useTimestampRefresh';
import type { Note } from '@/types/note';
import { getNoteTitle } from '@/types/note';

interface NoteListItemProps {
  note: Note;
  isSelected: boolean;
  onPress: () => void;
  searchQuery?: string;
  // Selection mode props
  selectionMode?: boolean;
  isChecked?: boolean;
  canSelect?: boolean;
}

interface HighlightedTextProps {
  text: string;
  query: string;
  baseStyle: object;
  highlightColor: string;
}

function HighlightedText({ text, query, baseStyle, highlightColor }: HighlightedTextProps) {
  if (!query.trim()) {
    return (
      <Text style={baseStyle} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  const parts: { text: string; highlight: boolean }[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let index = lowerText.indexOf(lowerQuery);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlight: false });
    }
    parts.push({ text: text.slice(index, index + query.length), highlight: true });
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  return (
    <Text style={baseStyle} numberOfLines={1}>
      {parts.map((part, i) =>
        part.highlight ? (
          <Text key={i} style={{ backgroundColor: highlightColor }}>
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = diffMs / (1000 * 60);
  const hours = diffMs / (1000 * 60 * 60);
  const days = diffMs / (1000 * 60 * 60 * 24);
  const weeks = days / 7;
  const months = days / 30;

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    const m = Math.floor(minutes);
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  } else if (days < 7) {
    const d = Math.floor(days);
    return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  } else if (weeks < 4) {
    const w = Math.round(weeks * 10) / 10;
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
  } else {
    const mo = Math.round(months * 10) / 10;
    return `${mo} ${mo === 1 ? 'month' : 'months'} ago`;
  }
}

export function NoteListItem({
  note,
  isSelected,
  onPress,
  searchQuery,
  selectionMode = false,
  isChecked = false,
  canSelect = true,
}: NoteListItemProps) {
  const colors = useThemeColors();
  const title = getNoteTitle(note.content);
  const query = searchQuery?.trim() || '';

  // Subscribe to shared timestamp refresh (single timer for all items)
  useTimestampRefresh();

  // Check if this note is shared with me (has owner_email = not my note)
  const isSharedWithMe = !!note.owner_email;

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: isSelected && !selectionMode ? colors.bgSelected : 'transparent',
        opacity: selectionMode && !canSelect ? 0.5 : 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            marginRight: 8,
          }}
        >
          {selectionMode && canSelect && (
            <View style={{ marginRight: 8, flexShrink: 0 }}>
              {isChecked ? (
                <SquareCheck size={18} color={colors.primary} />
              ) : (
                <Square size={18} color={colors.iconMuted} />
              )}
            </View>
          )}
          {note.pinned && (
            <Pin size={12} color={colors.primary} style={{ marginRight: 4, flexShrink: 0 }} />
          )}
          {isSharedWithMe ? (
            // Note shared with me - show person icon
            <CircleUser
              size={12}
              color={colors.info || '#3b82f6'}
              style={{ marginRight: 4, flexShrink: 0 }}
            />
          ) : note.is_private ? (
            // My private note
            <Lock size={12} color={colors.textMuted} style={{ marginRight: 4, flexShrink: 0 }} />
          ) : (
            // My shared note
            <Users size={12} color={colors.textMuted} style={{ marginRight: 4, flexShrink: 0 }} />
          )}
          <HighlightedText
            text={title}
            query={query}
            baseStyle={{
              color: colors.text,
              fontWeight: '500',
              fontSize: 16,
              flex: 1,
              minWidth: 0,
            }}
            highlightColor={colors.searchHighlight || '#fef08a'}
          />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, flexShrink: 0 }}>
          {formatRelativeTime(note.updated_at)}
        </Text>
      </View>
    </Pressable>
  );
}
