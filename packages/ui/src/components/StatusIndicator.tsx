import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'loading' | 'error' | 'success' | 'idle';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

/**
 * Loading spinner / error icon / success check indicator.
 */
export function StatusIndicator({ status, size = 'md', message }: StatusIndicatorProps) {
  const iconClass = sizeClasses[size];
  const textClass = textSizeClasses[size];

  const renderIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className={`${iconClass} animate-spin text-text-muted`} />;
      case 'error':
        return <AlertCircle className={`${iconClass} text-danger`} />;
      case 'success':
        return <CheckCircle2 className={`${iconClass} text-success`} />;
      case 'idle':
        return null;
    }
  };

  if (status === 'idle' && !message) return null;

  return (
    <div className="inline-flex items-center gap-2">
      {renderIcon()}
      {message && (
        <span
          className={`${textClass} ${
            status === 'error'
              ? 'text-danger'
              : status === 'success'
                ? 'text-success'
                : 'text-text-muted'
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
