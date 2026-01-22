import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search notes...' }: SearchBarProps) {
  return (
    <div className="flex items-center rounded-lg px-3 py-2 mx-4 my-2 bg-zinc-100 dark:bg-zinc-800">
      <Search size={18} className="text-zinc-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-base ml-2 outline-none text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        autoCapitalize="off"
        autoCorrect="off"
      />
      {value.length > 0 && (
        <button onClick={() => onChange('')} className="p-1 hover:opacity-70">
          <X size={18} className="text-zinc-500" />
        </button>
      )}
    </div>
  );
}
