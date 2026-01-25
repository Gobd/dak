import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

const variantClasses = {
  default: 'bg-surface-sunken text-text hover:bg-border',
  primary: 'bg-accent text-text hover:bg-accent-hover',
  secondary: 'bg-surface-sunken text-text hover:bg-border',
  ghost: 'bg-transparent text-accent hover:bg-surface-sunken',
  danger: 'bg-danger text-text hover:opacity-90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      loading = false,
      disabled,
      type = 'button',
      className = '',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`rounded-lg font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
