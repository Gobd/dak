import { View, TextInput, Pressable } from 'react-native';
import Search from 'lucide-react-native/dist/esm/icons/search';
import X from 'lucide-react-native/dist/esm/icons/x';
import { useThemeColors } from '@/hooks/useThemeColors';

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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBg,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 16,
        marginVertical: 8,
      }}
    >
      <Search size={18} color={colors.iconMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        style={{
          flex: 1,
          color: colors.inputText,
          fontSize: 16,
          marginLeft: 8,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} style={{ padding: 4 }}>
          <X size={18} color={colors.iconMuted} />
        </Pressable>
      )}
    </View>
  );
}
