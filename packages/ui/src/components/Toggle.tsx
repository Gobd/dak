interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}

const sizeClasses = {
  sm: {
    track: 'w-8 h-4',
    thumb: 'w-3 h-3',
    translate: 'translate-x-4',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-5 h-5',
    translate: 'translate-x-5',
  },
} as const;

/**
 * Switch component for on/off states.
 */
export function Toggle({ checked, onChange, disabled, size = 'md', label }: ToggleProps) {
  const sizes = sizeClasses[size];

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${sizes.track} ${
          checked ? 'bg-accent' : 'bg-surface-sunken border border-border'
        }`}
      >
        <span
          className={`inline-block rounded-full bg-surface shadow transform transition-transform duration-200 ease-in-out ${sizes.thumb} ${
            checked ? sizes.translate : 'translate-x-0.5'
          }`}
          style={{ marginTop: size === 'md' ? '2px' : '2px' }}
        />
      </button>
      {label && <span className={`text-text ${disabled ? 'opacity-50' : ''}`}>{label}</span>}
    </label>
  );
}
