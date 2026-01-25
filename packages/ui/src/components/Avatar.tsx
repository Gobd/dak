interface AvatarProps {
  name: string;
  emoji?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-sm',
  sm: 'w-8 h-8 text-base',
  md: 'w-10 h-10 text-lg',
  lg: 'w-12 h-12 text-xl',
  xl: 'w-16 h-16 text-3xl',
};

/**
 * Avatar circle with emoji or initials.
 * Can optionally show the name below and be clickable.
 */
export function Avatar({
  name,
  emoji,
  color = 'var(--color-accent)',
  size = 'md',
  showName = false,
  onClick,
  selected,
}: AvatarProps) {
  const Component = onClick ? 'button' : 'div';

  // Generate initials if no emoji
  const display = emoji || name.slice(0, 2).toUpperCase();

  return (
    <Component
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${
          selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
        }`}
        style={{ backgroundColor: color }}
      >
        {display}
      </div>
      {showName && <span className="text-xs text-text-muted truncate max-w-[60px]">{name}</span>}
    </Component>
  );
}
