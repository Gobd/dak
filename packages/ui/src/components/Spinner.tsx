interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
};

/**
 * Simple spinning loader indicator.
 * Use fullScreen to center in viewport with a background.
 */
export function Spinner({ size = 'md', fullScreen = false, className = '' }: SpinnerProps) {
  const spinner = (
    <div
      className={`${sizeClasses[size]} border-accent border-t-transparent rounded-full animate-spin ${className}`}
    />
  );

  if (fullScreen) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-surface">
        {spinner}
      </div>
    );
  }

  return spinner;
}
