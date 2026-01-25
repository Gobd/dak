import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  loading?: boolean;
  rounded?: boolean;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
  icon: 'p-2',
  'icon-sm': 'p-1.5',
};

const variantClasses = {
  default: 'bg-accent text-white hover:bg-accent-hover',
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface-sunken text-text hover:bg-border',
  ghost: 'bg-transparent text-accent hover:bg-surface-sunken',
  danger: 'bg-danger text-white hover:opacity-90',
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
      rounded = false,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const roundedClass = rounded ? 'rounded-full' : 'rounded-lg';

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`${roundedClass} font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
