interface ProgressRingProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg' | number; // Preset or custom pixel size
  strokeWidth?: number; // Custom stroke width (uses default for preset sizes)
  showValue?: boolean;
  colorByProgress?: boolean; // Auto-color based on percentage
  className?: string;
}

const sizeConfig = {
  sm: { size: 32, strokeWidth: 3, fontSize: 'text-xs' },
  md: { size: 48, strokeWidth: 4, fontSize: 'text-sm' },
  lg: { size: 64, strokeWidth: 5, fontSize: 'text-base' },
} as const;

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'var(--color-success)';
  if (percentage >= 75) return 'var(--color-accent)';
  if (percentage >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function getFontSize(pixelSize: number): string {
  if (pixelSize <= 36) return 'text-xs';
  if (pixelSize <= 52) return 'text-sm';
  return 'text-base';
}

/**
 * SVG circular progress indicator.
 * Supports auto-coloring based on progress percentage.
 * Size can be a preset ('sm', 'md', 'lg') or a custom pixel value.
 */
export function ProgressRing({
  value,
  max = 100,
  size = 'md',
  strokeWidth: customStrokeWidth,
  showValue,
  colorByProgress,
  className = '',
}: ProgressRingProps) {
  // Handle both preset sizes and custom pixel values
  const isPreset = typeof size === 'string';
  const config = isPreset ? sizeConfig[size] : null;
  const pixelSize = isPreset ? config!.size : size;
  const strokeWidth = customStrokeWidth ?? (isPreset ? config!.strokeWidth : 4);
  const fontSize = isPreset ? config!.fontSize : getFontSize(pixelSize);

  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (pixelSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const strokeColor = colorByProgress ? getProgressColor(percentage) : 'var(--color-accent)';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <svg width={pixelSize} height={pixelSize} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {showValue && (
        <span className={`absolute ${fontSize} font-medium text-text`}>
          {Math.round(percentage)}
        </span>
      )}
    </div>
  );
}
