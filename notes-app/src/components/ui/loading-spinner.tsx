interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', fullScreen = false }: LoadingSpinnerProps) {
  const sizeClass = size === 'large' ? 'w-8 h-8' : 'w-4 h-4';

  const spinner = (
    <div
      className={`${sizeClass} border-2 border-accent border-t-transparent rounded-full animate-spin`}
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
