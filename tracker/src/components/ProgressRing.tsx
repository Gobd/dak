import { getRingColor } from '../lib/motivation';
import { formatUnits } from '../lib/units';

interface ProgressRingProps {
  current: number;
  target: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({ current, target, size = 200, strokeWidth = 12 }: ProgressRingProps) {
  const percentage = target > 0 ? (current / target) * 100 : 0;
  const cappedPercentage = Math.min(percentage, 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (cappedPercentage / 100) * circumference;

  const ringColor = getRingColor(percentage);
  const isOver = percentage > 100;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-raised"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ${ringColor}`}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-4xl font-bold ${getRingColor(percentage).replace('stroke-', 'text-')}`}
        >
          {formatUnits(current)}
        </span>
        <span className="text-text-muted text-sm">of {formatUnits(target)} units</span>
        {isOver && (
          <span className="text-danger text-sm font-medium mt-1">
            +{Math.round(percentage - 100)}% over
          </span>
        )}
      </div>
    </div>
  );
}
