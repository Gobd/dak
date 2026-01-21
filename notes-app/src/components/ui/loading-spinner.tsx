import { useThemeColors } from '../../hooks/useThemeColors';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', color, fullScreen = false }: LoadingSpinnerProps) {
  const colors = useThemeColors();
  const spinnerColor = color || colors.primary;
  const sizeClass = size === 'large' ? 'w-8 h-8' : 'w-4 h-4';

  const spinner = (
    <div
      className={`${sizeClass} border-2 border-t-transparent rounded-full animate-spin`}
      style={{
        borderColor: spinnerColor,
        borderTopColor: 'transparent',
      }}
    />
  );

  if (fullScreen) {
    return (
      <div
        className="flex-1 flex items-center justify-center min-h-screen"
        style={{ backgroundColor: colors.bg }}
      >
        {spinner}
      </div>
    );
  }

  return spinner;
}
