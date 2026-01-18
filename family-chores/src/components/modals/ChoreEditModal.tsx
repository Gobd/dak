import { useState } from 'react';
import { X, Check, HelpCircle } from 'lucide-react';
import { useMembersStore } from '../../stores/members-store';
import { useSettingsStore } from '../../stores/settings-store';
import { SchedulePicker, type ScheduleConfig } from '../shared/SchedulePicker';
import { MemberAvatar } from '../shared/MemberAvatar';
import type { ChoreWithAssignments } from '../../types';

interface ChoreEditModalProps {
  chore?: ChoreWithAssignments; // undefined = new chore
  onSave: (
    data: {
      name: string;
      description?: string;
      points: number;
      schedule_type: string;
      interval_days?: number;
      weekly_days?: number[];
      monthly_day?: number;
      assignment_type: 'anyone' | 'everyone';
      times_per_day?: number;
      target_count?: number;
      goal_period?: 'daily' | 'weekly' | 'monthly';
    },
    assigneeIds: string[]
  ) => Promise<void>;
  onClose: () => void;
}

export function ChoreEditModal({ chore, onSave, onClose }: ChoreEditModalProps) {
  const { members } = useMembersStore();
  const { settings } = useSettingsStore();
  const hidePoints = settings?.hide_points ?? false;
  const isEditing = !!chore;

  // Form state
  const [name, setName] = useState(chore?.name ?? '');
  const [description, setDescription] = useState(chore?.description ?? '');
  const [points, setPoints] = useState(chore?.points ?? 1);
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    type: chore?.schedule_type ?? 'daily',
    intervalDays: chore?.interval_days ?? undefined,
    weeklyDays: chore?.weekly_days ?? undefined,
    monthlyDay: chore?.monthly_day ?? undefined,
    targetCount: chore?.target_count ?? undefined,
    goalPeriod: chore?.goal_period ?? undefined,
  });
  const [timesPerDay, setTimesPerDay] = useState(chore?.times_per_day ?? 1);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    chore?.assignments.map((a) => a.member.id) ?? []
  );
  const [assignmentType, setAssignmentType] = useState<'anyone' | 'everyone'>(
    chore?.assignment_type ?? 'everyone'
  );
  const [saving, setSaving] = useState(false);
  const [showAssignmentHelp, setShowAssignmentHelp] = useState(false);

  const toggleAssignee = (memberId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || assigneeIds.length === 0) return;
    setSaving(true);
    await onSave(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        points,
        schedule_type: schedule.type,
        interval_days: schedule.intervalDays,
        weekly_days: schedule.weeklyDays,
        monthly_day: schedule.monthlyDay,
        // Goals are always "everyone" (per-person, no race)
        assignment_type: schedule.type === 'goal' ? 'everyone' : assignmentType,
        // Multi-daily (only for daily schedule)
        times_per_day: schedule.type === 'daily' ? timesPerDay : 1,
        // Goal fields
        target_count: schedule.type === 'goal' ? schedule.targetCount : undefined,
        goal_period: schedule.type === 'goal' ? schedule.goalPeriod : undefined,
      },
      assigneeIds
    );
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Chore' : 'New Chore'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Make bed, Take vitamins"
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white"
            />
          </div>

          {/* Points - hidden when hide_points is enabled */}
          {!hidePoints && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Points
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPoints(Math.max(0, points - 1))}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-xl font-medium hover:bg-gray-50 dark:hover:bg-neutral-600"
                >
                  −
                </button>
                <span className="text-2xl font-semibold w-12 text-center dark:text-white">
                  {points}
                </span>
                <button
                  type="button"
                  onClick={() => setPoints(Math.min(100, points + 1))}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-xl font-medium hover:bg-gray-50 dark:hover:bg-neutral-600"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <SchedulePicker value={schedule} onChange={setSchedule} />

          {/* Times per day - only for daily schedule */}
          {schedule.type === 'daily' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Times per day
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTimesPerDay(Math.max(1, timesPerDay - 1))}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-xl font-medium hover:bg-gray-50 dark:hover:bg-neutral-600"
                >
                  −
                </button>
                <span className="text-2xl font-semibold w-12 text-center dark:text-white">
                  {timesPerDay}
                </span>
                <button
                  type="button"
                  onClick={() => setTimesPerDay(Math.min(10, timesPerDay + 1))}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-xl font-medium hover:bg-gray-50 dark:hover:bg-neutral-600"
                >
                  +
                </button>
              </div>
              {timesPerDay > 1 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Creates {timesPerDay} separate checkboxes per day
                </p>
              )}
            </div>
          )}

          {/* Assignees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
              Assign to
            </label>
            <div className="flex gap-2 flex-wrap">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleAssignee(member.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    assigneeIds.includes(member.id)
                      ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500'
                      : 'bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  <MemberAvatar
                    name={member.name}
                    emoji={member.avatar_emoji}
                    color={member.color}
                    size="sm"
                  />
                  <span className="text-sm dark:text-white">{member.name}</span>
                </button>
              ))}
            </div>
            {assigneeIds.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Select at least one person
              </p>
            )}
          </div>

          {/* Assignment Type - hide for goals (always per-person) */}
          {assigneeIds.length > 1 && schedule.type !== 'goal' && (
            <div className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                  How should this work?
                </span>
                <button
                  type="button"
                  onClick={() => setShowAssignmentHelp(!showAssignmentHelp)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                >
                  <HelpCircle size={16} />
                </button>
              </div>

              {showAssignmentHelp && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">Race mode:</p>
                  <p className="mb-2">
                    First person to complete wins all the points. Great for motivating quick action!
                  </p>
                  <p className="font-medium mb-1">Each person:</p>
                  <p>Everyone gets their own task and earns points individually.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentType('anyone')}
                  className={`p-3 rounded-lg text-left transition-all ${
                    assignmentType === 'anyone'
                      ? 'bg-amber-100 dark:bg-amber-900/50 ring-2 ring-amber-500'
                      : 'bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">Race</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                    First to finish wins
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentType('everyone')}
                  className={`p-3 rounded-lg text-left transition-all ${
                    assignmentType === 'everyone'
                      ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500'
                      : 'bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">Each person</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                    Everyone does it
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 dark:text-neutral-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || assigneeIds.length === 0 || saving}
            className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Check size={18} />
            {saving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
