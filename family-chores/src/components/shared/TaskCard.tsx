import { Check, Trophy, User } from 'lucide-react';
import type { ChoreInstanceWithDetails } from '../../types';
import { MemberAvatar } from './MemberAvatar';
import { format } from 'date-fns';
import { useSettingsStore } from '../../stores/settings-store';

interface TaskCardProps {
  instance: ChoreInstanceWithDetails;
  onToggle: () => void;
  onSelectMember?: () => void;
  showAssignees?: boolean;
}

export function TaskCard({
  instance,
  onToggle,
  onSelectMember,
  showAssignees = true,
}: TaskCardProps) {
  const { chore, completed, completed_by_member, assigned_member, assignees, points_awarded } =
    instance;
  const { settings } = useSettingsStore();
  const hidePoints = settings?.hide_points ?? false;

  // For "anyone" mode (no assigned_member), show as shared/race
  const isSharedTask = !assigned_member;

  const handleToggle = () => {
    if (completed) {
      // Always allow uncomplete
      onToggle();
    } else if (isSharedTask && onSelectMember) {
      // Shared task - need to pick who did it
      onSelectMember();
    } else {
      // Personal task - direct complete
      onToggle();
    }
  };

  // Get left border color based on task type
  const getLeftBorderStyle = () => {
    if (completed) return '';
    if (isSharedTask && assignees.length > 1) {
      // Race task - amber dashed border
      return 'border-l-4 border-l-amber-400 dark:border-l-amber-500';
    }
    if (assigned_member) {
      // Personal task - solid border in member's color
      return 'border-l-4';
    }
    return '';
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 sm:p-4 bg-surface-raised rounded-xl shadow-sm border ${
        completed ? 'border-green-200 dark:border-green-800 bg-success-light/20' : 'border-border'
      } ${getLeftBorderStyle()}`}
      style={!completed && assigned_member ? { borderLeftColor: assigned_member.color } : undefined}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
          completed
            ? 'bg-success border-success text-text'
            : 'border-border hover:border-accent hover:bg-blue-50 dark:hover:bg-blue-900/20'
        }`}
      >
        {completed && <Check size={28} strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className={`font-medium text-base sm:text-lg truncate ${
                completed ? 'text-text-muted line-through' : 'text-text'
              }`}
            >
              {chore.name}
              {(chore.times_per_day ?? 1) > 1 && (
                <span className="text-text-muted font-normal text-sm ml-1">
                  ({instance.occurrence_number} of {chore.times_per_day})
                </span>
              )}
            </h3>
            {chore.description && (
              <p className="text-sm text-text-muted truncate">{chore.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Assignment mode badge - only show for multi-assignee tasks */}
            {assignees.length > 1 && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  isSharedTask
                    ? 'bg-warning-light/50 text-amber-700 dark:text-amber-300'
                    : 'bg-surface-sunken text-text-secondary text-text-muted'
                }`}
              >
                {isSharedTask ? (
                  <>
                    <Trophy size={10} />
                    Race
                  </>
                ) : (
                  <>
                    <User size={10} />
                    Each
                  </>
                )}
              </span>
            )}
            {!hidePoints && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  completed
                    ? 'bg-success-light/50 text-green-700 dark:text-success'
                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                }`}
              >
                {points_awarded} pts
              </span>
            )}
          </div>
        </div>

        {/* Assignees or completed by */}
        <div className="flex items-center justify-between mt-2">
          {showAssignees && (
            <div className="flex items-center gap-1">
              {completed && completed_by_member ? (
                <>
                  <MemberAvatar
                    name={completed_by_member.name}
                    emoji={completed_by_member.avatar_emoji}
                    color={completed_by_member.color}
                    size="sm"
                  />
                  <span className="text-xs text-text-muted ml-1">{completed_by_member.name}</span>
                </>
              ) : (
                assignees.map((member) => (
                  <MemberAvatar
                    key={member.id}
                    name={member.name}
                    emoji={member.avatar_emoji}
                    color={member.color}
                    size="sm"
                  />
                ))
              )}
            </div>
          )}

          {completed && instance.completed_at && (
            <span className="text-xs text-text-muted">
              {format(new Date(instance.completed_at), 'h:mm a')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
