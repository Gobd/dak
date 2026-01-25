import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'selected' | 'outline';
  size?: 'sm' | 'md';
  onRemove?: () => void;
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
    { children, variant = 'default', size = 'md', onRemove, className = '', onClick, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`inline-flex items-center font-medium rounded-full transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
            className="ml-0.5 hover:text-text"
          >
            ×
          </span>
        )}
      </button>
    );
  },
);

Chip.displayName = 'Chip';
