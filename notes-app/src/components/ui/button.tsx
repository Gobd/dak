import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      onPress,
      onClick,
      disabled = false,
      loading = false,
      variant = 'primary',
      size = 'md',
      children,
      className,
      ...props
    },
    ref
  ) => {
    const colors = useThemeColors();
    const isDisabled = disabled || loading;

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg',
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
      <button
        ref={ref}
        onClick={onPress || onClick}
        disabled={isDisabled}
        className={`rounded-lg flex items-center justify-center font-semibold transition-opacity ${sizeClasses[size]} ${className || ''}`}
        style={{
          backgroundColor: getBackgroundColor(),
          color: getTextColor(),
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
        {...props}
      >
        {loading ? (
          <div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            style={{
              borderColor: variant === 'ghost' ? colors.primary : colors.primaryText,
              borderTopColor: 'transparent',
            }}
          />
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
