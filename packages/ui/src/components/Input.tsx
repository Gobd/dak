import { forwardRef, useState, type InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  /** Size variant: 'sm' for inline/compact, 'md' (default) for forms */
  size?: 'sm' | 'md';
  /** Set to true for inline inputs that shouldn't have wrapper div */
  inline?: boolean;
}

const sizeClasses = {
  sm: 'px-2 py-1 rounded text-sm',
  md: 'px-4 py-3 rounded-lg text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, size = 'md', inline = false, className, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    const inputElement = (
      <input
        ref={ref}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        className={`w-full outline-none transition-colors border bg-surface-sunken text-text placeholder:text-text-muted disabled:opacity-50 ${sizeClasses[size]} ${
          error ? 'border-danger' : isFocused ? 'border-accent' : 'border-border'
        } ${className || ''}`}
        {...props}
      />
    );

    // For inline inputs, return just the input without wrapper
    if (inline) {
      return inputElement;
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5 text-text-secondary">{label}</label>
        )}
        {inputElement}
        {error && <p className="text-sm mt-1 text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
