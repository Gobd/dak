import { Search, X } from 'lucide-react';
import { useThemeColors } from '../hooks/useThemeColors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search notes...',
}: SearchBarProps) {
  const colors = useThemeColors();

  return (
    <div
      className="flex items-center rounded-lg px-3 py-2 mx-4 my-2"
      style={{ backgroundColor: colors.inputBg }}
    >
      <Search size={18} color={colors.iconMuted} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-base ml-2 outline-none"
        style={{ color: colors.inputText }}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {value.length > 0 && (
        <button onClick={() => onChangeText('')} className="p-1 hover:opacity-70">
          <X size={18} color={colors.iconMuted} />
        </button>
      )}
    </div>
  );
}
