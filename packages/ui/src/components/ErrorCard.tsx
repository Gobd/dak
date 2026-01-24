import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorCardProps {
  message: string;
  details?: string;
  onRetry?: () => void;
}

/**
 * Styled error message card with icon and optional retry button.
 */
export function ErrorCard({ message, details, onRetry }: ErrorCardProps) {
  return (
    <div className="rounded-lg bg-danger-light border border-danger/20 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-danger-dark font-medium">{message}</p>
          {details && <p className="text-danger-dark/80 text-sm mt-1">{details}</p>}
          {onRetry && (
            <Button onClick={onRetry} variant="default" className="mt-3">
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
