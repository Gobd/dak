import { forwardRef, type InputHTMLAttributes } from 'react';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showRange?: boolean;
  thumbColor?: 'default' | 'accent' | 'warning' | 'success';
}

const thumbColors = {
  default: '[&::-webkit-slider-thumb]:bg-surface',
  accent: '[&::-webkit-slider-thumb]:bg-accent',
  warning: '[&::-webkit-slider-thumb]:bg-warning',
  success: '[&::-webkit-slider-thumb]:bg-success',
};

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      label,
      showRange = false,
      thumbColor = 'default',
      className = '',
      ...props
    },
    ref,
  ) => {
    return (
      <div className={className}>
        {label && <label className="block text-sm text-text-muted mb-2">{label}</label>}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer
                     bg-surface-sunken
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-5
                     [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:shadow-md
                     ${thumbColors[thumbColor]}`}
          {...props}
        />
        {showRange && (
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    );
  },
);

Slider.displayName = 'Slider';
