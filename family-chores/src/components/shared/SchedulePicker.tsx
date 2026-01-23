interface ScheduleConfig {
  type: 'daily' | 'every_x_days' | 'weekly' | 'monthly' | 'as_needed' | 'goal';
  intervalDays?: number;
  weeklyDays?: number[];
  monthlyDay?: number;
  // For goals/habits
  targetCount?: number;
  goalPeriod?: 'daily' | 'weekly' | 'monthly';
}

interface SchedulePickerProps {
  value: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const handleTypeChange = (type: ScheduleConfig['type']) => {
    const newConfig: ScheduleConfig = { type };
    if (type === 'every_x_days') {
      newConfig.intervalDays = 2;
    } else if (type === 'weekly') {
      newConfig.weeklyDays = [1]; // Monday default
    } else if (type === 'monthly') {
      newConfig.monthlyDay = 1;
    } else if (type === 'goal') {
      newConfig.targetCount = 3;
      newConfig.goalPeriod = 'weekly';
    }
    onChange(newConfig);
  };

  const toggleWeeklyDay = (day: number) => {
    const current = value.weeklyDays ?? [];
    const newDays = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    onChange({ ...value, weeklyDays: newDays.length > 0 ? newDays : [day] });
  };

  return (
    <div className="space-y-4">
      {/* Schedule type */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Repeats</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'daily', label: 'Daily' },
            { value: 'every_x_days', label: 'Every X Days' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'as_needed', label: 'As Needed' },
            { value: 'goal', label: 'Goal/Habit' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTypeChange(option.value as ScheduleConfig['type'])}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                value.type === option.value
                  ? 'bg-accent text-text'
                  : 'bg-surface-sunken text-text-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interval days */}
      {value.type === 'every_x_days' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Every how many days?
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  intervalDays: Math.max(1, (value.intervalDays ?? 2) - 1),
                })
              }
              className="w-10 h-10 rounded-lg bg-surface-sunken text-xl font-medium"
            >
              −
            </button>
            <span className="text-2xl font-semibold w-12 text-center">
              {value.intervalDays ?? 2}
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  intervalDays: Math.min(30, (value.intervalDays ?? 2) + 1),
                })
              }
              className="w-10 h-10 rounded-lg bg-surface-sunken text-xl font-medium"
            >
              +
            </button>
            <span className="text-text-muted">days</span>
          </div>
        </div>
      )}

      {/* Weekly days */}
      {value.type === 'weekly' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            On which days?
          </label>
          <div className="flex gap-1 flex-wrap">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWeeklyDay(day.value)}
                className={`w-11 h-11 rounded-lg text-sm font-medium ${
                  (value.weeklyDays ?? []).includes(day.value)
                    ? 'bg-accent text-text'
                    : 'bg-surface-sunken text-text-secondary'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly day */}
      {value.type === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            On which day of the month?
          </label>
          <select
            value={value.monthlyDay ?? 1}
            onChange={(e) => onChange({ ...value, monthlyDay: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
                {day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
              </option>
            ))}
            <option value={-1}>Last day</option>
          </select>
        </div>
      )}

      {/* Goal/Habit configuration */}
      {value.type === 'goal' && (
        <div className="space-y-4 p-3 bg-feature-light rounded-lg border border-feature">
          <p className="text-xs text-accent">
            Set a target to complete this habit a certain number of times within a period.
          </p>

          {/* Period selector */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Period</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      goalPeriod: option.value as 'daily' | 'weekly' | 'monthly',
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    value.goalPeriod === option.value
                      ? 'bg-accent text-text'
                      : 'bg-surface-sunken text-text-secondary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target count */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Target: {value.targetCount ?? 3}x per{' '}
              {value.goalPeriod === 'daily'
                ? 'day'
                : value.goalPeriod === 'weekly'
                  ? 'week'
                  : 'month'}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    targetCount: Math.max(1, (value.targetCount ?? 3) - 1),
                  })
                }
                className="w-10 h-10 rounded-lg bg-surface-sunken text-xl font-medium border border-border"
              >
                −
              </button>
              <span className="text-2xl font-semibold w-12 text-center text-text">
                {value.targetCount ?? 3}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    targetCount: Math.min(31, (value.targetCount ?? 3) + 1),
                  })
                }
                className="w-10 h-10 rounded-lg bg-surface-sunken text-xl font-medium border border-border"
              >
                +
              </button>
              <span className="text-text-muted">times</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ScheduleConfig };
