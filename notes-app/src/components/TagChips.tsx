import { useState } from 'react';
import { Hash } from 'lucide-react';
import { Input, Button } from '@dak/ui';
import type { Tag } from '../types/tag';

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
  const [searchQuery, setSearchQuery] = useState('');

  const tagsWithNotes = tags.filter((tag) => (tagCounts[tag.id] || 0) > 0);
  const filteredTags = searchQuery.trim()
    ? tagsWithNotes.filter((tag) => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tagsWithNotes;

  return (
    <div className="mb-4">
      <span className="block text-xs font-semibold uppercase px-3 mb-2 text-text-muted">Tags</span>

      {tagsWithNotes.length > 3 && (
        <div className="px-3 mb-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tags..."
          />
        </div>
      )}

      {filteredTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <Button
            key={tag.id}
            variant="ghost"
            onClick={() => onSelectTag(isSelected ? null : tag.id)}
            className={`w-full flex items-center py-2 px-3 h-auto justify-start rounded-none ${
              isSelected ? 'bg-surface-sunken' : ''
            }`}
          >
            <Hash
              size={16}
              style={{ color: tag.color ?? undefined }}
              className={tag.color ? '' : 'text-text-muted'}
            />
            <span
              className={`ml-2 text-sm flex-1 truncate ${
                isSelected ? 'text-text font-medium' : 'text-text-secondary'
              }`}
            >
              {tag.name}
            </span>
            {tagCounts[tag.id] !== undefined && (
              <span className="text-xs ml-1 text-text-muted">({tagCounts[tag.id]})</span>
            )}
          </Button>
        );
      })}

      {tags.length === 0 && <p className="text-sm px-3 py-2 text-text-muted">No tags yet</p>}

      {tags.length > 0 && filteredTags.length === 0 && (
        <p className="text-sm px-3 py-2 text-text-muted">No matching tags</p>
      )}
    </div>
  );
}
