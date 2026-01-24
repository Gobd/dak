import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Empty state placeholder with icon, message, and optional CTA.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 mb-4 text-text-muted">
        {icon || <Inbox className="w-full h-full" />}
      </div>
      <h3 className="text-lg font-medium text-text mb-1">{title}</h3>
      {description && <p className="text-text-secondary mb-4 max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
