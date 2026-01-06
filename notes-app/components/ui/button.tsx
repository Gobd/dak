import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { forwardRef, type ReactNode } from 'react';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

export const Button = forwardRef<View, ButtonProps>(
  (
    { onPress, disabled = false, loading = false, variant = 'primary', size = 'md', children },
    ref
  ) => {
    const colors = useThemeColors();
    const isDisabled = disabled || loading;

    const sizeStyles = {
      sm: { paddingHorizontal: 12, paddingVertical: 8 },
      md: { paddingHorizontal: 16, paddingVertical: 12 },
      lg: { paddingHorizontal: 24, paddingVertical: 16 },
    };

    const textSizes = {
      sm: 14,
      md: 16,
      lg: 18,
    };

    const getBackgroundColor = () => {
      switch (variant) {
        case 'primary':
          return colors.primary;
        case 'secondary':
          return colors.bgTertiary;
        case 'ghost':
          return 'transparent';
        default:
          return colors.primary;
      }
    };

    const getTextColor = () => {
      switch (variant) {
        case 'primary':
          return colors.primaryText;
        case 'secondary':
          return colors.text;
        case 'ghost':
          return colors.primary;
        default:
          return colors.primaryText;
      }
    };

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={isDisabled}
        style={{
          backgroundColor: getBackgroundColor(),
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: isDisabled ? 0.5 : 1,
          ...sizeStyles[size],
        }}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'ghost' ? colors.primary : colors.primaryText}
          />
        ) : typeof children === 'string' ? (
          <Text
            style={{
              color: getTextColor(),
              fontWeight: '600',
              fontSize: textSizes[size],
            }}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
