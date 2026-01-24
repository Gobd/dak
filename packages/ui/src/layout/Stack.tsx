import type { ReactNode } from 'react';

interface StackProps {
  children: ReactNode;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
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
  stretch: 'items-stretch',
} as const;

/**
 * Vertical stack with consistent spacing.
 * Uses flex column with configurable gap and alignment.
 */
export function Stack({ children, gap = 'md', align = 'stretch', className = '' }: StackProps) {
  return (
    <div className={`flex flex-col ${gapClasses[gap]} ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
}
