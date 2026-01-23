import { useState, useEffect, useMemo, useRef } from 'react';
import { DatePicker } from './DatePicker';
import { Roller } from './Roller';

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  showDatePicker?: boolean;
  allowFuture?: boolean;
  minuteStep?: number; // Default 5, can be 1 for precise selection
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function generateMinutes(step: number): number[] {
  const minutes: number[] = [];
  for (let i = 0; i < 60; i += step) {
    minutes.push(i);
  }
  return minutes;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DateTimePicker({
  value,
  onChange,
  showDatePicker = true,
  allowFuture = false,
  minuteStep = 5,
}: DateTimePickerProps) {
  const minutes = useMemo(() => generateMinutes(minuteStep), [minuteStep]);

  const now = new Date();
  const baseDate = value || now;

  const [selectedDate, setSelectedDate] = useState(() => new Date(baseDate));
  const [hour, setHour] = useState(() => {
    const h = baseDate.getHours();
    return h === 0 ? 12 : h > 12 ? h - 12 : h;
  });
  const [minute, setMinute] = useState(() => {
    // Find closest minute increment
    const m = baseDate.getMinutes();
    return minutes.reduce((prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev));
  });
  const [isPM, setIsPM] = useState(() => baseDate.getHours() >= 12);
  const [showCalendar, setShowCalendar] = useState(false);

  // Store onChange in ref to avoid it triggering the effect (prevents memory leak from unstable callbacks)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Emit changes when any value changes
  useEffect(() => {
    const date = new Date(selectedDate);

    let h = hour;
    if (isPM && hour !== 12) h = hour + 12;
    if (!isPM && hour === 12) h = 0;

    date.setHours(h, minute, 0, 0);
    onChangeRef.current(date);
  }, [hour, minute, isPM, selectedDate]);

  const handleDateSelect = (date: Date) => {
    // Check if date is allowed
    if (!allowFuture) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (date > todayStart) return;
    }
    setSelectedDate(date);
    setShowCalendar(false);
  };

  return (
    <div className="bg-surface-raised rounded-xl p-4">
      <div className="flex items-center justify-center gap-4">
        {/* Date button */}
        {showDatePicker && (
          <button
            onClick={() => setShowCalendar(true)}
            type="button"
            className="px-3 py-2 bg-surface-sunken rounded-lg text-text font-medium text-sm border border-border hover:border-accent transition-colors"
          >
            {formatDisplayDate(selectedDate)}
          </button>
        )}

        {/* Time rollers */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-10">
            <Roller items={HOURS} value={hour} onChange={setHour} />
          </div>
          <div className="text-xl font-bold text-text-muted">:</div>
          <div className="w-10">
            <Roller
              items={minutes}
              value={minute}
              onChange={setMinute}
              format={(v) => String(v).padStart(2, '0')}
            />
          </div>
          <div className="flex flex-col gap-1 ml-1">
            <button
              onClick={() => setIsPM(false)}
              type="button"
              className={`px-2 py-1 rounded-md font-medium text-xs transition-colors ${
                !isPM ? 'bg-accent text-text' : 'bg-surface-sunken text-text-secondary'
              }`}
            >
              AM
            </button>
            <button
              onClick={() => setIsPM(true)}
              type="button"
              className={`px-2 py-1 rounded-md font-medium text-xs transition-colors ${
                isPM ? 'bg-accent text-text' : 'bg-surface-sunken text-text-secondary'
              }`}
            >
              PM
            </button>
          </div>
        </div>
      </div>

      {/* Date picker modal */}
      {showCalendar && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setShowCalendar(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DatePicker
              value={selectedDate}
              onChange={handleDateSelect}
              allowFuture={allowFuture}
            />
          </div>
        </div>
      )}
    </div>
  );
}
