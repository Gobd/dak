import { useState } from 'react';
import { X, Plus, Hash } from 'lucide-react';
import { useThemeColors } from '../hooks/useThemeColors';
import type { Tag } from '../types/tag';

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
    <button
      onClick={onPress}
      className="flex items-center rounded-full transition-opacity"
      style={{
        paddingLeft: isSmall ? 8 : 12,
        paddingRight: isSmall ? 8 : 12,
        paddingTop: isSmall ? 2 : 4,
        paddingBottom: isSmall ? 2 : 4,
        opacity: selected ? 1 : 0.8,
        backgroundColor: bgColor + '33',
      }}
    >
      <Hash size={isSmall ? 10 : 12} color={bgColor} />
      <span className="ml-1 truncate" style={{ fontSize: isSmall ? 12 : 14, color: bgColor }}>
        {tag.name}
      </span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 p-0.5 hover:opacity-70"
        >
          <X size={isSmall ? 10 : 12} color={bgColor} />
        </button>
      )}
    </button>
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
    <div className="flex flex-wrap gap-1">
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
    </div>
  );

  if (horizontal) {
    return <div className="overflow-x-auto scrollbar-hide">{content}</div>;
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
    <div className="rounded-lg p-3" style={{ backgroundColor: colors.bgTertiary }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
          Tags
        </span>
        <button onClick={() => setIsCreating(true)} className="p-1 hover:opacity-70">
          <Plus size={16} color={colors.icon} />
        </button>
      </div>

      {isCreating && (
        <div className="mb-3 p-2 rounded" style={{ backgroundColor: colors.bgHover }}>
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
            autoFocus
            className="w-full mb-2 px-2 py-1 rounded text-sm outline-none"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.inputText,
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
          />
          <div className="flex gap-2 mb-2">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className="w-6 h-6 rounded-full transition-all"
                style={{
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 2 : 0,
                  borderColor: colors.text,
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsCreating(false)}
              className="flex-1 py-1 rounded text-sm"
              style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTag}
              className="flex-1 py-1 rounded text-sm font-medium"
              style={{ backgroundColor: colors.primary, color: colors.primaryText }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => onToggleTag(tag.id)}
              className="flex items-center rounded-full px-3 py-1"
              style={{
                borderWidth: isSelected ? 1 : 0,
                borderColor: colors.primary,
                backgroundColor: (tag.color || '#71717a') + '33',
              }}
            >
              <Hash size={12} color={tag.color || '#71717a'} />
              <span className="ml-1 text-sm" style={{ color: tag.color || '#71717a' }}>
                {tag.name}
              </span>
            </button>
          );
        })}
        {allTags.length === 0 && !isCreating && (
          <span className="text-sm" style={{ color: colors.textMuted }}>
            No tags yet. Create one!
          </span>
        )}
      </div>
    </div>
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
    <div className="mb-4">
      <span
        className="block text-xs font-semibold uppercase px-3 mb-2"
        style={{ color: colors.textMuted }}
      >
        Tags
      </span>

      {/* Search bar - only show if there are many tags with notes */}
      {tagsWithNotes.length > 3 && (
        <div className="px-3 mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tags..."
            className="w-full px-2.5 py-1.5 rounded-md text-[13px] outline-none"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.inputText,
            }}
          />
        </div>
      )}

      {filteredTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <button
            key={tag.id}
            onClick={() => onSelectTag(isSelected ? null : tag.id)}
            className="w-full flex items-center py-2 px-3 text-left transition-colors"
            style={{
              backgroundColor: isSelected ? colors.bgHover : 'transparent',
            }}
          >
            <Hash size={16} color={tag.color || colors.icon} />
            <span
              className="ml-2 text-sm flex-1 truncate"
              style={{
                color: isSelected ? colors.text : colors.textSecondary,
                fontWeight: isSelected ? 500 : 400,
              }}
            >
              {tag.name}
            </span>
            {tagCounts[tag.id] !== undefined && (
              <span className="text-xs ml-1" style={{ color: colors.textMuted }}>
                ({tagCounts[tag.id]})
              </span>
            )}
          </button>
        );
      })}

      {tags.length === 0 && (
        <p className="text-sm px-3 py-2" style={{ color: colors.textMuted }}>
          No tags yet
        </p>
      )}

      {tags.length > 0 && filteredTags.length === 0 && (
        <p className="text-sm px-3 py-2" style={{ color: colors.textMuted }}>
          No matching tags
        </p>
      )}
    </div>
  );
}
