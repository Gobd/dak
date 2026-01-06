import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import X from 'lucide-react-native/dist/esm/icons/x';
import Plus from 'lucide-react-native/dist/esm/icons/plus';
import Hash from 'lucide-react-native/dist/esm/icons/hash';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Tag } from '@/types/tag';

// Predefined colors for tags
const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

interface TagChipProps {
  tag: Tag;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function TagChip({ tag, selected, onPress, onRemove, size = 'md' }: TagChipProps) {
  const bgColor = tag.color || '#71717a';
  const isSmall = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingHorizontal: isSmall ? 8 : 12,
        paddingVertical: isSmall ? 2 : 4,
        opacity: selected ? 1 : 0.8,
        backgroundColor: bgColor + '33',
      }}
    >
      <Hash size={isSmall ? 10 : 12} color={bgColor} />
      <Text
        style={{ fontSize: isSmall ? 12 : 14, marginLeft: 4, color: bgColor }}
        numberOfLines={1}
      >
        {tag.name}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} style={{ marginLeft: 4, padding: 2 }}>
          <X size={isSmall ? 10 : 12} color={bgColor} />
        </Pressable>
      )}
    </Pressable>
  );
}

interface TagListProps {
  tags: Tag[];
  selectedTags?: Tag[];
  onTagPress?: (tag: Tag) => void;
  onTagRemove?: (tag: Tag) => void;
  horizontal?: boolean;
  size?: 'sm' | 'md';
}

export function TagList({
  tags,
  selectedTags = [],
  onTagPress,
  onTagRemove,
  horizontal = true,
  size = 'md',
}: TagListProps) {
  const selectedIds = new Set(selectedTags.map((t) => t.id));

  if (tags.length === 0) {
    return null;
  }

  const content = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          selected={selectedIds.has(tag.id)}
          onPress={onTagPress ? () => onTagPress(tag) : undefined}
          onRemove={onTagRemove ? () => onTagRemove(tag) : undefined}
          size={size}
        />
      ))}
    </View>
  );

  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {content}
      </ScrollView>
    );
  }

  return content;
}

interface TagSelectorProps {
  allTags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => void;
}

export function TagSelector({
  allTags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
}: TagSelectorProps) {
  const colors = useThemeColors();
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim(), selectedColor);
      setNewTagName('');
      setIsCreating(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 8, padding: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>Tags</Text>
        <Pressable onPress={() => setIsCreating(true)} style={{ padding: 4 }}>
          <Plus size={16} color={colors.icon} />
        </Pressable>
      </View>

      {isCreating && (
        <View
          style={{ marginBottom: 12, padding: 8, backgroundColor: colors.bgHover, borderRadius: 4 }}
        >
          <TextInput
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="Tag name"
            placeholderTextColor={colors.inputPlaceholder}
            autoFocus
            style={{
              color: colors.inputText,
              fontSize: 14,
              marginBottom: 8,
              backgroundColor: colors.bgSecondary,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 4,
            }}
            onSubmitEditing={handleCreateTag}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {TAG_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setSelectedColor(color)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 2 : 0,
                  borderColor: colors.text,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setIsCreating(false)}
              style={{
                flex: 1,
                paddingVertical: 4,
                backgroundColor: colors.bgSecondary,
                borderRadius: 4,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreateTag}
              style={{
                flex: 1,
                paddingVertical: 4,
                backgroundColor: colors.primary,
                borderRadius: 4,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '500' }}>
                Create
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              onPress={() => onToggleTag(tag.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderWidth: isSelected ? 1 : 0,
                borderColor: colors.primary,
                backgroundColor: (tag.color || '#71717a') + '33',
              }}
            >
              <Hash size={12} color={tag.color || '#71717a'} />
              <Text style={{ fontSize: 14, marginLeft: 4, color: tag.color || '#71717a' }}>
                {tag.name}
              </Text>
            </Pressable>
          );
        })}
        {allTags.length === 0 && !isCreating && (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>No tags yet. Create one!</Text>
        )}
      </View>
    </View>
  );
}

interface TagsSidebarSectionProps {
  tags: Tag[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  tagCounts?: Record<string, number>;
}

export function TagsSidebarSection({
  tags,
  selectedTagId,
  onSelectTag,
  tagCounts = {},
}: TagsSidebarSectionProps) {
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter out tags with no notes, then apply search filter
  const tagsWithNotes = tags.filter((tag) => (tagCounts[tag.id] || 0) > 0);
  const filteredTags = searchQuery.trim()
    ? tagsWithNotes.filter((tag) => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tagsWithNotes;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: colors.textMuted,
          textTransform: 'uppercase',
          paddingHorizontal: 12,
          marginBottom: 8,
        }}
      >
        Tags
      </Text>

      {/* Search bar - only show if there are many tags with notes */}
      {tagsWithNotes.length > 3 && (
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Filter tags..."
            placeholderTextColor={colors.inputPlaceholder}
            style={{
              color: colors.inputText,
              fontSize: 13,
              backgroundColor: colors.bgSecondary,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
            }}
          />
        </View>
      )}

      {filteredTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <Pressable
            key={tag.id}
            onPress={() => onSelectTag(isSelected ? null : tag.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: isSelected ? colors.bgHover : 'transparent',
            }}
          >
            <Hash size={16} color={tag.color || colors.icon} />
            <Text
              style={{
                marginLeft: 8,
                fontSize: 14,
                color: isSelected ? colors.text : colors.textSecondary,
                fontWeight: isSelected ? '500' : '400',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {tag.name}
            </Text>
            {tagCounts[tag.id] !== undefined && (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  marginLeft: 4,
                }}
              >
                ({tagCounts[tag.id]})
              </Text>
            )}
          </Pressable>
        );
      })}

      {tags.length === 0 && (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          No tags yet
        </Text>
      )}

      {tags.length > 0 && filteredTags.length === 0 && (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          No matching tags
        </Text>
      )}
    </View>
  );
}
