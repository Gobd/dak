import { Search, X } from 'lucide-react';
import { Button } from './Button';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Search field with icon and clear button.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
  autoFocus,
  className = '',
}: SearchInputProps) {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-9 py-2 rounded-lg bg-surface-sunken border border-border text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
