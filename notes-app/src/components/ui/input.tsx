import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChangeText?: (text: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  onSubmitEditing?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChangeText,
      onChange,
      placeholder,
      type = 'text',
      autoComplete = 'off',
      label,
      error,
      disabled = false,
      multiline = false,
      numberOfLines = 1,
      onSubmitEditing,
      className,
      ...props
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChangeText?.(e.target.value);
      onChange?.(e as React.ChangeEvent<HTMLInputElement>);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline && onSubmitEditing) {
        e.preventDefault();
        onSubmitEditing();
      }
    };

    const commonStyles = {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: getBorderColor(),
      color: colors.inputText,
      opacity: disabled ? 0.5 : 1,
    };

    const commonClasses =
      'w-full px-4 py-3 rounded-lg text-base outline-none transition-colors border';

    return (
      <div className="w-full">
        {label && (
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: colors.textSecondary }}
          >
            {label}
          </label>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={numberOfLines}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            className={`${commonClasses} resize-none ${className || ''}`}
            style={{
              ...commonStyles,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ['--placeholder-color' as any]: colors.inputPlaceholder,
            }}
          />
        ) : (
          <input
            ref={ref}
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            className={`${commonClasses} ${className || ''}`}
            style={commonStyles}
            {...props}
          />
        )}
        {error && (
          <p className="text-sm mt-1" style={{ color: colors.error }}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
