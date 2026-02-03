import { Star } from 'lucide-react';

interface StarRatingProps {
  rating?: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({
  rating = 0,
  onRatingChange,
  readonly = false,
  size = 'md',
}: StarRatingProps) {
  const sizeClasses = {
    lg: 'w-6 h-6',
    md: 'w-5 h-5',
    sm: 'w-4 h-4',
  };

  const handleStarClick = (event: React.MouseEvent, starValue: number) => {
    if (readonly || !onRatingChange) return;
    event.preventDefault();
    event.stopPropagation();
    onRatingChange(starValue);
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((starValue) => (
        <button
          key={starValue}
          type="button"
          onClick={(e) => handleStarClick(e, starValue)}
          disabled={readonly}
          className={`transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
          } ${!readonly && 'hover:text-warning'}`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              starValue <= rating ? 'fill-warning text-warning' : 'fill-none text-text-muted'
            }`}
          />
        </button>
      ))}
      {readonly && rating > 0 && (
        <span className="ml-1 text-sm text-text-secondary">({rating})</span>
      )}
    </div>
  );
}
