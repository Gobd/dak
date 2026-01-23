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
          <label className="block text-sm font-medium mb-1.5 text-zinc-600 dark:text-zinc-300">
            {label}
          </label>
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
          className={`w-full px-4 py-3 rounded-lg text-base outline-none transition-colors border bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-50 ${
            error
              ? 'border-red-500'
              : isFocused
                ? 'border-amber-500 dark:border-amber-400'
                : 'border-zinc-200 dark:border-zinc-700'
          } ${className || ''}`}
          {...props}
        />
        {error && <p className="text-sm mt-1 text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
