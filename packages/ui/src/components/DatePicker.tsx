import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  allowFuture?: boolean;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({ value, onChange, allowFuture = true }: DatePickerProps) {
  const [viewMonth, setViewMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

  // Always render 6 rows (42 cells) to prevent layout jumping
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  // Pad to 42 cells (6 rows)
  while (days.length < 42) {
    days.push(null);
  }

  const selectedStr = formatLocalDate(value);
  const todayStr = formatLocalDate(new Date());

  function handlePrevYear() {
    setViewMonth(new Date(viewMonth.getFullYear() - 1, viewMonth.getMonth(), 1));
  }

  function handlePrevMonth() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  }

  function handleNextYear() {
    setViewMonth(new Date(viewMonth.getFullYear() + 1, viewMonth.getMonth(), 1));
  }

  function isDayDisabled(day: number): boolean {
    if (allowFuture) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date > todayStart;
  }

  function handleSelectDay(day: number) {
    if (isDayDisabled(day)) return;
    onChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 w-[280px] shadow-lg border border-gray-200 dark:border-neutral-700">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevYear}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            type="button"
            aria-label="Previous year"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            type="button"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <span className="text-sm font-medium text-center flex-1 text-gray-900 dark:text-white">
          {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            type="button"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleNextYear}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            type="button"
            aria-label="Next year"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs text-gray-500 dark:text-neutral-500 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Days grid - always 6 rows */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="w-8 h-8" />;
          }

          const dateStr = formatLocalDate(
            new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day),
          );
          const isSelected = dateStr === selectedStr;
          const isToday = dateStr === todayStr;
          const disabled = isDayDisabled(day);

          return (
            <button
              key={day}
              onClick={() => handleSelectDay(day)}
              type="button"
              disabled={disabled}
              className={`w-8 h-8 text-sm rounded-full flex items-center justify-center transition-colors
                ${disabled ? 'text-gray-300 dark:text-neutral-600 cursor-not-allowed' : ''}
                ${isSelected && !disabled ? 'bg-blue-600 text-white' : ''}
                ${isToday && !isSelected && !disabled ? 'ring-1 ring-blue-500' : ''}
                ${!isSelected && !disabled ? 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-700' : ''}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact version that shows a button and opens a popup
export function DatePickerCompact({ value, onChange, allowFuture = true }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayDate = value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(true)}
        type="button"
        className="w-full p-2 rounded bg-gray-100 dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 text-left text-gray-900 dark:text-white"
      >
        {displayDate}
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-2xl">
            <DatePicker
              value={value}
              onChange={(d) => {
                onChange(d);
                setShowPicker(false);
              }}
              allowFuture={allowFuture}
            />
            <button
              onClick={() => setShowPicker(false)}
              type="button"
              className="w-full mt-3 px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 text-gray-900 dark:text-white font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
