interface AvatarProps {
  emoji?: string;
  initials?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  selected?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-2xl',
} as const;

/**
 * Circular avatar with emoji or initials.
 * Supports custom background color and selection state.
 */
export function Avatar({ emoji, initials, color, size = 'md', selected, onClick }: AvatarProps) {
  const isInteractive = !!onClick;
  const Component = isInteractive ? 'button' : 'div';

  return (
    <Component
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full font-medium select-none transition-all ${sizeClasses[size]} ${
        selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
      } ${isInteractive ? 'cursor-pointer hover:opacity-80' : ''}`}
      style={{
        backgroundColor: color || 'var(--color-surface-sunken)',
        color: color ? 'white' : 'var(--color-text)',
      }}
    >
      {emoji || initials || '?'}
    </Component>
  );
}
