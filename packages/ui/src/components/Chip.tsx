import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'selected' | 'outline';
  size?: 'sm' | 'md';
  onRemove?: () => void;
  /** Custom color (hex) - overrides variant styling */
  color?: string;
}

const variantClasses = {
  default: 'bg-surface-sunken text-text-secondary hover:bg-border',
  selected: 'bg-accent text-white',
  outline: 'bg-transparent border border-border text-text-secondary hover:bg-surface-sunken',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      onRemove,
      color,
      className = '',
      onClick,
      style,
      ...props
    },
    ref,
  ) => {
    // When custom color is provided, use it for background (with alpha) and text
    const customStyle: CSSProperties | undefined = color
      ? {
          backgroundColor: color + '33', // 20% opacity
          color: color,
          ...style,
        }
      : style;

    const colorClasses = color ? '' : variantClasses[variant];

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`inline-flex items-center font-medium rounded-full transition-colors ${colorClasses} ${sizeClasses[size]} ${className}`}
        style={customStyle}
        {...props}
      >
        {children}
        {onRemove && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 hover:opacity-70"
          >
            ×
          </span>
        )}
      </button>
    );
  },
);

Chip.displayName = 'Chip';
