import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { getDaysInMonth, format } from "date-fns";

const ITEM_HEIGHT = 44;

interface WheelProps {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}

function Wheel({ items, value, onChange }: WheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<number | null>(null);

  const selectedIndex = items.indexOf(value);

  useEffect(() => {
    if (containerRef.current && !isScrolling) {
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex, isScrolling]);

  const handleScroll = () => {
    setIsScrolling(true);
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    scrollTimeout.current = window.setTimeout(() => {
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
        containerRef.current.scrollTop = clampedIndex * ITEM_HEIGHT;
        if (items[clampedIndex] !== value) {
          onChange(items[clampedIndex]);
        }
      }
      setIsScrolling(false);
    }, 100);
  };

  return (
    <div className="relative h-[132px]">
      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-white dark:from-neutral-800 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-white dark:from-neutral-800 to-transparent z-10 pointer-events-none" />
      {/* Selection indicator */}
      <div className="absolute inset-x-0 top-11 h-11 border-y border-blue-500/30 bg-blue-500/10 pointer-events-none" />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[132px] overflow-y-auto scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}
      >
        {/* Padding items for scroll */}
        <div style={{ height: ITEM_HEIGHT }} />
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-center text-xl font-medium cursor-pointer select-none"
            style={{ height: ITEM_HEIGHT }}
            onClick={() => onChange(item)}
          >
            <span
              className={
                item === value
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-neutral-500"
              }
            >
              {item}
            </span>
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT }} />
      </div>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface MiniCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  allowFuture?: boolean;
}

function MiniCalendar({
  selectedDate,
  onSelect,
  onClose,
  allowFuture = false,
}: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const today = new Date();

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth));

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day);
    // Check if date is allowed
    if (!allowFuture) {
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      if (newDate > todayStart) return;
    }
    onSelect(newDate);
  };

  const isDayDisabled = (day: number) => {
    if (allowFuture) return false;
    const date = new Date(viewYear, viewMonth, day);
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    return date > todayStart;
  };

  const isDaySelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      viewMonth === selectedDate.getMonth() &&
      viewYear === selectedDate.getFullYear()
    );
  };

  const isDayToday = (day: number) => {
    return (
      day === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear()
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl p-4 min-w-[280px] shadow-xl border border-gray-200 dark:border-neutral-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-600 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            &lt;
          </button>
          <span className="font-semibold text-gray-900 dark:text-white">
            {FULL_MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-600 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            &gt;
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 dark:text-neutral-400 py-1"
            >
              {day.charAt(0)}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before first of month */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const disabled = isDayDisabled(day);
            const selected = isDaySelected(day);
            const isToday = isDayToday(day);

            return (
              <button
                key={day}
                onClick={() => !disabled && handleDayClick(day)}
                disabled={disabled}
                className={`
                  aspect-square flex items-center justify-center text-sm rounded-full transition-colors
                  ${disabled ? "text-gray-300 dark:text-neutral-600 cursor-not-allowed" : "cursor-pointer"}
                  ${selected ? "bg-blue-600 text-white" : ""}
                  ${isToday && !selected ? "border border-blue-500" : ""}
                  ${!selected && !disabled ? "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-700" : ""}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  showDatePicker?: boolean;
  allowFuture?: boolean;
}

export function TimePicker({
  value,
  onChange,
  showDatePicker = true,
  allowFuture = false,
}: TimePickerProps) {
  const now = new Date();
  const baseDate = value || now;

  const [selectedDate, setSelectedDate] = useState(() => new Date(baseDate));
  const [hour, setHour] = useState(() => {
    const h = baseDate.getHours();
    return h === 0 ? 12 : h > 12 ? h - 12 : h;
  });
  const [minute, setMinute] = useState(() => {
    return Math.floor(baseDate.getMinutes() / 5) * 5;
  });
  const [isPM, setIsPM] = useState(() => baseDate.getHours() >= 12);
  const [showCalendar, setShowCalendar] = useState(false);

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0"),
  );

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  }, []);

  useEffect(() => {
    const date = new Date(selectedDate);

    let h = hour;
    if (isPM && hour !== 12) h = hour + 12;
    if (!isPM && hour === 12) h = 0;

    date.setHours(h, minute, 0, 0);
    onChange(date);
  }, [hour, minute, isPM, selectedDate, onChange]);

  const formattedDate = format(selectedDate, "MMM d, yyyy");

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-center gap-4">
        {/* Date button */}
        {showDatePicker && (
          <button
            onClick={() => setShowCalendar(true)}
            className="px-3 py-2 bg-gray-100 dark:bg-neutral-700 rounded-lg text-gray-900 dark:text-white font-medium text-sm border border-gray-200 dark:border-neutral-600 hover:border-blue-500 transition-colors"
          >
            {formattedDate}
          </button>
        )}

        {/* Time wheels */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-10">
            <Wheel
              items={hours}
              value={String(hour)}
              onChange={(v) => setHour(Number(v))}
            />
          </div>
          <div className="text-xl font-bold text-gray-400">:</div>
          <div className="w-10">
            <Wheel
              items={minutes}
              value={String(minute).padStart(2, "0")}
              onChange={(v) => setMinute(Number(v))}
            />
          </div>
          <div className="flex flex-col gap-1 ml-1">
            <button
              onClick={() => setIsPM(false)}
              className={`px-2 py-1 rounded-md font-medium text-xs transition-colors ${
                !isPM
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"
              }`}
            >
              AM
            </button>
            <button
              onClick={() => setIsPM(true)}
              className={`px-2 py-1 rounded-md font-medium text-xs transition-colors ${
                isPM
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"
              }`}
            >
              PM
            </button>
          </div>
        </div>
      </div>

      {/* Mini calendar popup */}
      {showCalendar && (
        <MiniCalendar
          selectedDate={selectedDate}
          onSelect={handleDateSelect}
          onClose={() => setShowCalendar(false)}
          allowFuture={allowFuture}
        />
      )}
    </div>
  );
}
