import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, disabled, children, className, ...props },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg',
    };

    const variantClasses = {
      primary: 'bg-warning text-black hover:bg-warning dark:hover:bg-warning',
      secondary: 'bg-surface-sunken text-text hover:bg-surface-sunken',
      ghost: 'bg-transparent text-warning hover:bg-surface-sunken dark:hover:bg-surface-raised',
      danger: 'bg-danger text-text hover:bg-danger-hover',
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`rounded-lg flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className || ''}`}
        {...props}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
