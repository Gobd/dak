import type { ReactNode } from 'react';

interface MasonryGridProps {
  children: ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return (
    <div
      style={{
        columns: 'var(--masonry-cols, 3)',
        columnGap: '1rem',
      }}
      className="[--masonry-cols:2] sm:[--masonry-cols:3] lg:[--masonry-cols:4]"
    >
      {children}
    </div>
  );
}
