import { useState } from 'react';
import { Check, HelpCircle } from 'lucide-react';
import { Avatar, Modal } from '@dak/ui';
import { useMembersStore } from '../../stores/members-store';
import { useSettingsStore } from '../../stores/settings-store';
import { SchedulePicker, type ScheduleConfig } from '../shared/SchedulePicker';
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
    assigneeIds: string[],
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
    chore?.assignments.map((a) => a.member.id) ?? [],
  );
  const [assignmentType, setAssignmentType] = useState<'anyone' | 'everyone'>(
    chore?.assignment_type ?? 'everyone',
  );
  const [saving, setSaving] = useState(false);
  const [showAssignmentHelp, setShowAssignmentHelp] = useState(false);

  const toggleAssignee = (memberId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
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
      assigneeIds,
    );
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEditing ? 'Edit Chore' : 'New Chore'}
      actions={
        <>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-surface-raised text-text-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || assigneeIds.length === 0 || saving}
            className="flex-1 bg-accent text-text px-4 py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-accent-hover"
          >
            <Check size={18} />
            {saving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Make bed, Take vitamins"
            maxLength={100}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            maxLength={200}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text"
          />
        </div>

        {/* Points - hidden when hide_points is enabled */}
        {!hidePoints && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Points</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPoints(Math.max(0, points - 1))}
                className="w-10 h-10 rounded-lg bg-surface-sunken border border-border text-xl font-medium hover:bg-surface"
              >
                −
              </button>
              <span className="text-2xl font-semibold w-12 text-center text-text">{points}</span>
              <button
                type="button"
                onClick={() => setPoints(Math.min(100, points + 1))}
                className="w-10 h-10 rounded-lg bg-surface-sunken border border-border text-xl font-medium hover:bg-surface"
              >
                +
              </button>
            </div>
          </div>
        )}

        <SchedulePicker value={schedule} onChange={setSchedule} />

        {/* Times per day - only for daily schedule */}
        {schedule.type === 'daily' && (
          <div className="p-3 bg-accent-light rounded-lg border border-accent">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Times per day
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTimesPerDay(Math.max(1, timesPerDay - 1))}
                className="w-10 h-10 rounded-lg bg-surface-sunken border border-border text-xl font-medium hover:bg-surface"
              >
                −
              </button>
              <span className="text-2xl font-semibold w-12 text-center text-text">
                {timesPerDay}
              </span>
              <button
                type="button"
                onClick={() => setTimesPerDay(Math.min(10, timesPerDay + 1))}
                className="w-10 h-10 rounded-lg bg-surface-sunken border border-border text-xl font-medium hover:bg-surface"
              >
                +
              </button>
            </div>
            {timesPerDay > 1 && (
              <p className="text-xs text-accent mt-2">
                Creates {timesPerDay} separate checkboxes per day
              </p>
            )}
          </div>
        )}

        {/* Assignees */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Assign to</label>
          <div className="flex gap-2 flex-wrap">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleAssignee(member.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  assigneeIds.includes(member.id)
                    ? 'bg-accent-light ring-2 ring-accent'
                    : 'bg-surface-sunken hover:bg-surface-sunken'
                }`}
              >
                <Avatar
                  name={member.name}
                  emoji={member.avatar_emoji}
                  color={member.color}
                  size="sm"
                />
                <span className="text-sm text-text">{member.name}</span>
              </button>
            ))}
          </div>
          {assigneeIds.length === 0 && (
            <p className="text-sm text-warning mt-2">Select at least one person</p>
          )}
        </div>

        {/* Assignment Type - hide for goals (always per-person) */}
        {assigneeIds.length > 1 && schedule.type !== 'goal' && (
          <div className="p-3 bg-surface-raised rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">How should this work?</span>
              <button
                type="button"
                onClick={() => setShowAssignmentHelp(!showAssignmentHelp)}
                className="p-1 text-text-muted hover:text-text-secondary dark:hover:text-text-secondary"
              >
                <HelpCircle size={16} />
              </button>
            </div>

            {showAssignmentHelp && (
              <div className="mb-3 p-2 bg-accent-light rounded text-xs text-accent">
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
                    ? 'bg-warning-light/50 ring-2 ring-warning'
                    : 'bg-surface-sunken hover:bg-surface'
                }`}
              >
                <p className="font-medium text-sm text-text">Race</p>
                <p className="text-xs text-text-muted mt-0.5">First to finish wins</p>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('everyone')}
                className={`p-3 rounded-lg text-left transition-all ${
                  assignmentType === 'everyone'
                    ? 'bg-accent-light ring-2 ring-accent'
                    : 'bg-surface-sunken hover:bg-surface'
                }`}
              >
                <p className="font-medium text-sm text-text">Each person</p>
                <p className="text-xs text-text-muted mt-0.5">Everyone does it</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
