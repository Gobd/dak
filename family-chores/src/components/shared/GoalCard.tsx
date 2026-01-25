import { Plus, Minus, Check } from 'lucide-react';
import type { GoalProgress } from '../../types';
import { Avatar } from '@dak/ui';
import { useSettingsStore } from '../../stores/settings-store';

interface GoalCardProps {
  progress: GoalProgress;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function GoalCard({ progress, onIncrement, onDecrement }: GoalCardProps) {
  const { chore, member, target_count, completions_this_period, is_complete } = progress;
  const { settings } = useSettingsStore();
  const hidePoints = settings?.hide_points ?? false;

  // Generate progress dots (max 10 visible, then show count)
  const showDots = target_count <= 10;
  const dots = [];
  if (showDots) {
    for (let i = 0; i < target_count; i++) {
      dots.push(
        <span
          key={i}
          className={`w-3 h-3 rounded-full transition-colors ${
            i < completions_this_period ? 'bg-success' : 'bg-surface-sunken'
          }`}
        />,
      );
    }
    // Show extra dots for over-achievement
    for (let i = target_count; i < completions_this_period; i++) {
      dots.push(<span key={`extra-${i}`} className="w-3 h-3 rounded-full bg-accent" />);
    }
  }

  const periodLabel =
    chore.goal_period === 'daily'
      ? 'today'
      : chore.goal_period === 'weekly'
        ? 'this week'
        : 'this month';

  return (
    <div
      className={`flex items-center gap-3 p-3 sm:p-4 bg-surface-raised rounded-xl shadow-sm border transition-all ${
        is_complete ? 'border-success bg-success-light/20' : 'border-border'
      }`}
    >
      {/* Increment button */}
      <button
        onClick={onIncrement}
        className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
          is_complete
            ? 'bg-success border-success text-text hover:bg-success'
            : 'border-feature text-feature hover:border-feature-hover hover:bg-feature-light'
        }`}
      >
        {is_complete ? <Check size={28} strokeWidth={3} /> : <Plus size={24} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Avatar name={member.name} emoji={member.avatar_emoji} color={member.color} size="sm" />
          <h3
            className={`font-medium text-base truncate ${
              is_complete ? 'text-text-muted' : 'text-text'
            }`}
          >
            {chore.name}
          </h3>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {showDots ? (
            dots
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 bg-surface-sunken rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${is_complete ? 'bg-success' : 'bg-accent'}`}
                  style={{
                    width: `${Math.min(100, (completions_this_period / target_count) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          <span className="text-xs text-text-muted ml-1">
            {completions_this_period}/{target_count} {periodLabel}
          </span>
        </div>
      </div>

      {/* Points & Decrement */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!hidePoints && (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              is_complete ? 'bg-success-light/50 text-success' : 'bg-feature-light text-feature'
            }`}
          >
            {chore.points} pts
          </span>
        )}

        {/* Decrement button - only show if there are completions */}
        {completions_this_period > 0 && (
          <button
            onClick={onDecrement}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-muted hover:bg-surface-sunken"
          >
            <Minus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
