interface MemberAvatarProps {
  name: string;
  emoji: string;
  color: string;
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

export function MemberAvatar({
  name,
  emoji,
  color,
  size = 'md',
  showName = false,
  onClick,
  selected,
}: MemberAvatarProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${
          selected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-neutral-900' : ''
        }`}
        style={{ backgroundColor: color }}
      >
        {emoji}
      </div>
      {showName && (
        <span className="text-xs text-gray-600 dark:text-neutral-400 truncate max-w-[60px]">
          {name}
        </span>
      )}
    </Component>
  );
}
