import type { ReactNode } from 'react';

interface SplitProps {
  children: ReactNode; // Expects exactly 2 children
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const gapClasses = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
} as const;

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
} as const;

/**
 * Two-column layout with space between.
 * Perfect for header rows (title + actions).
 */
export function Split({ children, gap = 'md', align = 'center', className = '' }: SplitProps) {
  return (
    <div className={`flex justify-between ${gapClasses[gap]} ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
}
