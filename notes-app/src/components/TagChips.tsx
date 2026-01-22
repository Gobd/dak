import { useState } from 'react';
import { Hash } from 'lucide-react';
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
      <span className="block text-xs font-semibold uppercase px-3 mb-2 text-zinc-500">Tags</span>

      {tagsWithNotes.length > 3 && (
        <div className="px-3 mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tags..."
            className="w-full px-2.5 py-1.5 rounded-md text-[13px] outline-none bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white"
          />
        </div>
      )}

      {filteredTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <button
            key={tag.id}
            onClick={() => onSelectTag(isSelected ? null : tag.id)}
            className={`w-full flex items-center py-2 px-3 text-left transition-colors ${
              isSelected ? 'bg-zinc-200 dark:bg-zinc-700' : ''
            }`}
          >
            <Hash
              size={16}
              style={{ color: tag.color ?? undefined }}
              className={tag.color ? '' : 'text-zinc-400'}
            />
            <span
              className={`ml-2 text-sm flex-1 truncate ${
                isSelected
                  ? 'text-zinc-950 dark:text-white font-medium'
                  : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              {tag.name}
            </span>
            {tagCounts[tag.id] !== undefined && (
              <span className="text-xs ml-1 text-zinc-500">({tagCounts[tag.id]})</span>
            )}
          </button>
        );
      })}

      {tags.length === 0 && <p className="text-sm px-3 py-2 text-zinc-500">No tags yet</p>}

      {tags.length > 0 && filteredTags.length === 0 && (
        <p className="text-sm px-3 py-2 text-zinc-500">No matching tags</p>
      )}
    </div>
  );
}
