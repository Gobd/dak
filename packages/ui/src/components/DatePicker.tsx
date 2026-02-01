import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  allowFuture?: boolean;
  /** Day the week starts on: 0 = Sunday (default), 1 = Monday */
  weekStartsOn?: 0 | 1;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_NAMES_SUNDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES_MONDAY = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function DatePicker({
  value,
  onChange,
  allowFuture = true,
  weekStartsOn = 0,
}: DatePickerProps) {
  const [viewMonth, setViewMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  const dayNames = weekStartsOn === 1 ? DAY_NAMES_MONDAY : DAY_NAMES_SUNDAY;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  // getDay() returns 0=Sunday, 1=Monday, etc.
  // Adjust for week start day
  const rawFirstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const firstDayOfWeek = (rawFirstDay - weekStartsOn + 7) % 7;

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
    <div className="bg-surface-raised rounded-lg p-3 w-[280px] shadow-lg border border-border">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handlePrevYear}
            aria-label="Previous year"
          >
            <ChevronsLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Button>
        </div>
        <span className="text-sm font-medium text-center flex-1 text-text">
          {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={handleNextMonth} aria-label="Next month">
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleNextYear} aria-label="Next year">
            <ChevronsRight size={16} />
          </Button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs text-text-muted py-1">
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
            <Button
              key={day}
              variant="ghost"
              onClick={() => handleSelectDay(day)}
              disabled={disabled}
              className={`w-8 h-8 p-0 text-sm rounded-full
                ${isSelected && !disabled ? 'bg-accent text-text hover:bg-accent' : ''}
                ${isToday && !isSelected && !disabled ? 'ring-1 ring-accent' : ''}`}
            >
              {day}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// Compact version that shows a button and opens a popup
export function DatePickerCompact({
  value,
  onChange,
  allowFuture = true,
  weekStartsOn = 0,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayDate = value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="relative">
      <Button
        variant="secondary"
        onClick={() => setShowPicker(true)}
        className="w-full justify-start"
      >
        {displayDate}
      </Button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-raised rounded-xl p-4 shadow-2xl">
            <DatePicker
              value={value}
              onChange={(d) => {
                onChange(d);
                setShowPicker(false);
              }}
              allowFuture={allowFuture}
              weekStartsOn={weekStartsOn}
            />
            <Button
              variant="secondary"
              onClick={() => setShowPicker(false)}
              className="w-full mt-3"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
