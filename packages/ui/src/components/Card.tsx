import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'raised' | 'sunken' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
}

const variantClasses = {
  raised: 'bg-surface-raised',
  sunken: 'bg-surface-sunken',
  outlined: 'bg-surface border border-border',
} as const;

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

/**
 * Container component with consistent styling.
 * Supports header and footer sections.
 */
export function Card({
  children,
  className = '',
  variant = 'raised',
  padding = 'md',
  header,
  footer,
}: CardProps) {
  return (
    <div className={`rounded-lg ${variantClasses[variant]} ${className}`}>
      {header && (
        <div className="px-4 py-3 border-b border-border font-medium text-text">{header}</div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && <div className="px-4 py-3 border-t border-border">{footer}</div>}
    </div>
  );
}
