import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  label: string; // For accessibility (aria-label)
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  badge?: number | string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantClasses = {
  default: 'bg-surface-sunken text-text hover:bg-border',
  primary: 'bg-accent text-text hover:bg-accent-hover',
  danger: 'bg-danger text-text hover:opacity-90',
  ghost: 'text-text-secondary hover:text-text hover:bg-surface-sunken',
} as const;

const sizeClasses = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
} as const;

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

const badgeVariantClasses = {
  default: 'bg-text text-surface',
  success: 'bg-success text-surface',
  warning: 'bg-warning text-surface',
  danger: 'bg-danger text-surface',
} as const;

/**
 * Icon-only button with tooltip support.
 * Supports loading state and optional badge.
 */
export function IconButton({
  icon,
  onClick,
  label,
  variant = 'default',
  size = 'md',
  disabled,
  loading,
  badge,
  badgeVariant = 'default',
  className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={`relative inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <Loader2 className={`animate-spin ${iconSizeClasses[size]}`} />
      ) : (
        <span className={iconSizeClasses[size]}>{icon}</span>
      )}
      {badge !== undefined && !loading && (
        <span
          className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-xs font-medium rounded-full flex items-center justify-center ${badgeVariantClasses[badgeVariant]}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
