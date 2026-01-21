import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${className}`}
    >
      {children}
    </div>
  );
}
