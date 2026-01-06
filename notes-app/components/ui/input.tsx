import { TextInput, View, Text } from 'react-native';
import { forwardRef, useState } from 'react';
import { useThemeColors } from '@/hooks/useThemeColors';

interface InputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoComplete?: 'email' | 'password' | 'off' | 'name' | 'username';
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  multiline?: boolean;
  numberOfLines?: number;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  blurOnSubmit?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      value,
      onChangeText,
      placeholder,
      secureTextEntry = false,
      autoCapitalize = 'none',
      keyboardType = 'default',
      autoComplete = 'off',
      label,
      error,
      disabled = false,
      multiline = false,
      numberOfLines = 1,
      onSubmitEditing,
      returnKeyType = 'done',
      blurOnSubmit = true,
    },
    ref
  ) => {
    const colors = useThemeColors();
    const [isFocused, setIsFocused] = useState(false);

    const getBorderColor = () => {
      if (error) return colors.error;
      if (isFocused) return colors.primary;
      return colors.border;
    };

    return (
      <View style={{ width: '100%' }}>
        {label && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              fontWeight: '500',
              marginBottom: 6,
            }}
          >
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: getBorderColor(),
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: colors.inputText,
            fontSize: 16,
            opacity: disabled ? 0.5 : 1,
          }}
        />
        {error && (
          <Text
            style={{
              color: colors.error,
              fontSize: 14,
              marginTop: 4,
            }}
          >
            {error}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';
