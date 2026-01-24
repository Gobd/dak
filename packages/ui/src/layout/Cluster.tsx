import type { ReactNode } from 'react';

interface ClusterProps {
  children: ReactNode;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  justify?: 'start' | 'center' | 'end' | 'between';
  align?: 'start' | 'center' | 'end' | 'baseline';
  wrap?: boolean;
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

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
} as const;

/**
 * Horizontal cluster with wrap support.
 * Great for tag lists, button groups, etc.
 */
export function Cluster({
  children,
  gap = 'md',
  justify = 'start',
  align = 'center',
  wrap = true,
  className = '',
}: ClusterProps) {
  return (
    <div
      className={`flex flex-row ${gapClasses[gap]} ${justifyClasses[justify]} ${alignClasses[align]} ${wrap ? 'flex-wrap' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
