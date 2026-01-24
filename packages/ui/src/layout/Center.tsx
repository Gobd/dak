import type { ReactNode } from 'react';

interface CenterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Centers content both horizontally and vertically.
 * Simple flex container with center alignment.
 */
export function Center({ children, className = '' }: CenterProps) {
  return <div className={`flex items-center justify-center ${className}`}>{children}</div>;
}
