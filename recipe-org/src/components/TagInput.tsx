import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@dak/ui';

interface TagInputProps {
  tags: string[];
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
  onTagClick?: (tag: string) => void;
  placeholder?: string;
}

export function TagInput({
  tags,
  availableTags,
  onTagsChange,
  onTagClick,
  placeholder = 'Add tags...',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = availableTags
    .filter(
      (tag) =>
        tag.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(tag) &&
        inputValue.length > 0,
    )
    .slice(0, 5);

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      onTagsChange([...tags, tag.trim()]);
    }
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
        addTag(filteredSuggestions[selectedSuggestionIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    if (inputValue && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(-1);
  }, [inputValue, filteredSuggestions.length]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-success/20 text-success text-sm rounded-md"
          >
            {onTagClick ? (
              <button
                type="button"
                onClick={() => onTagClick(tag)}
                className="cursor-pointer hover:underline"
                title={`Filter by ${tag} tag`}
              >
                {tag}
              </button>
            ) : (
              tag
            )}
            <button
              onClick={() => removeTag(tag)}
              className="hover:bg-success/30 p-0.5 ml-1 rounded"
              type="button"
              title={`Remove ${tag} tag`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-surface-raised border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-surface-sunken text-text ${
                  index === selectedSuggestionIndex ? 'bg-accent/10' : ''
                }`}
                onClick={() => addTag(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
