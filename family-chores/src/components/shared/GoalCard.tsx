import { Plus, Minus, Check } from "lucide-react";
import type { GoalProgress } from "../../types";
import { MemberAvatar } from "./MemberAvatar";
import { useSettingsStore } from "../../stores/settings-store";

interface GoalCardProps {
  progress: GoalProgress;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function GoalCard({ progress, onIncrement, onDecrement }: GoalCardProps) {
  const { chore, member, target_count, completions_this_period, is_complete } =
    progress;
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
            i < completions_this_period
              ? "bg-green-500"
              : "bg-gray-300 dark:bg-neutral-600"
          }`}
        />,
      );
    }
    // Show extra dots for over-achievement
    for (let i = target_count; i < completions_this_period; i++) {
      dots.push(
        <span
          key={`extra-${i}`}
          className="w-3 h-3 rounded-full bg-purple-500"
        />,
      );
    }
  }

  const periodLabel =
    chore.goal_period === "daily"
      ? "today"
      : chore.goal_period === "weekly"
        ? "this week"
        : "this month";

  return (
    <div
      className={`flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border transition-all ${
        is_complete
          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
          : "border-gray-200 dark:border-neutral-700"
      }`}
    >
      {/* Increment button */}
      <button
        onClick={onIncrement}
        className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
          is_complete
            ? "bg-green-500 border-green-500 text-white hover:bg-green-600"
            : "border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
        }`}
      >
        {is_complete ? <Check size={28} strokeWidth={3} /> : <Plus size={24} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <MemberAvatar
            name={member.name}
            emoji={member.avatar_emoji}
            color={member.color}
            size="sm"
          />
          <h3
            className={`font-medium text-base truncate ${
              is_complete
                ? "text-gray-500 dark:text-neutral-500"
                : "text-gray-900 dark:text-white"
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
              <div className="h-2 w-24 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    is_complete ? "bg-green-500" : "bg-purple-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (completions_this_period / target_count) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          <span className="text-xs text-gray-500 dark:text-neutral-400 ml-1">
            {completions_this_period}/{target_count} {periodLabel}
          </span>
        </div>
      </div>

      {/* Points & Decrement */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!hidePoints && (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              is_complete
                ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
            }`}
          >
            {chore.points} pts
          </span>
        )}

        {/* Decrement button - only show if there are completions */}
        {completions_this_period > 0 && (
          <button
            onClick={onDecrement}
            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-neutral-600 flex items-center justify-center text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <Minus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
