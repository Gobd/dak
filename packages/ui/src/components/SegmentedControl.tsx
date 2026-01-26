interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
} as const;

/**
 * Segmented control for selecting between a small set of mutually exclusive options.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-border">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`${sizeClasses[size]} font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
