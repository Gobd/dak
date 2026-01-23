import { forwardRef, useState, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium mb-1.5 text-text-secondary">{label}</label>
        )}
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
          className={`w-full px-4 py-3 rounded-lg text-base outline-none transition-colors border bg-surface-sunken text-text placeholder:text-text-muted placeholder:text-text-muted disabled:opacity-50 ${
            error ? 'border-danger' : isFocused ? 'border-accent' : 'border-border'
          } ${className || ''}`}
          {...props}
        />
        {error && <p className="text-sm mt-1 text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
