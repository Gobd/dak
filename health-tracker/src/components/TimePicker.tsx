import { useRef, useEffect, useState, useMemo } from "react";
import { getDaysInMonth } from "date-fns";

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

interface TimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  showDatePicker?: boolean;
  allowFuture?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function TimePicker({
  value,
  onChange,
  showDatePicker = true,
  allowFuture = false,
}: TimePickerProps) {
  const now = new Date();
  const baseDate = value || now;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const [year, setYear] = useState(() => baseDate.getFullYear());
  const [month, setMonth] = useState(() => baseDate.getMonth());
  const [day, setDay] = useState(() => baseDate.getDate());
  const [hour, setHour] = useState(() => {
    const h = baseDate.getHours();
    return h === 0 ? 12 : h > 12 ? h - 12 : h;
  });
  const [minute, setMinute] = useState(() => {
    return Math.floor(baseDate.getMinutes() / 5) * 5;
  });
  const [isPM, setIsPM] = useState(() => baseDate.getHours() >= 12);

  // Available years: past year + current for logging, current + next for future
  const availableYears = useMemo(() => {
    if (allowFuture) {
      return [String(currentYear), String(currentYear + 1)];
    }
    return [String(currentYear - 1), String(currentYear)];
  }, [allowFuture, currentYear]);

  // Calculate days in selected month/year
  const daysInMonth = useMemo(() => {
    return getDaysInMonth(new Date(year, month));
  }, [year, month]);

  // Filter months based on allowFuture and selected year
  const availableMonths = useMemo(() => {
    if (allowFuture) {
      // Future: if current year, only future months; if next year, all months
      if (year === currentYear) {
        return MONTHS.slice(currentMonth);
      }
      return MONTHS;
    } else {
      // Past: if current year, only past months; if last year, all months
      if (year === currentYear) {
        return MONTHS.slice(0, currentMonth + 1);
      }
      return MONTHS;
    }
  }, [allowFuture, year, currentYear, currentMonth]);

  // Clamp month if year changes and month is out of range
  useEffect(() => {
    if (!availableMonths.includes(MONTHS[month])) {
      const newMonthIndex = MONTHS.indexOf(availableMonths[allowFuture ? 0 : availableMonths.length - 1]);
      setMonth(newMonthIndex);
    }
  }, [availableMonths, month, allowFuture]);

  // Filter days based on allowFuture, selected year/month
  const availableDays = useMemo(() => {
    const isCurrentYearMonth = year === currentYear && month === currentMonth;
    let maxDay: number;

    if (allowFuture) {
      // For future dates, show all days in month
      maxDay = daysInMonth;
    } else {
      // For past dates, limit to today if current year/month
      maxDay = isCurrentYearMonth ? currentDay : daysInMonth;
    }

    return Array.from({ length: maxDay }, (_, i) => String(i + 1));
  }, [allowFuture, year, month, currentYear, currentMonth, currentDay, daysInMonth]);

  // Clamp day if it exceeds available days
  useEffect(() => {
    const maxAvailableDay = Number(availableDays[availableDays.length - 1]);
    if (day > maxAvailableDay) {
      setDay(maxAvailableDay);
    }
  }, [availableDays, day]);

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0"),
  );

  useEffect(() => {
    const date = new Date(year, month, day);

    let h = hour;
    if (isPM && hour !== 12) h = hour + 12;
    if (!isPM && hour === 12) h = 0;

    date.setHours(h, minute, 0, 0);
    onChange(date);
  }, [hour, minute, isPM, month, day, year, onChange]);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-center gap-1">
        {showDatePicker && (
          <>
            <div className="w-14">
              <Wheel
                items={availableMonths}
                value={MONTHS[month]}
                onChange={(v) => setMonth(MONTHS.indexOf(v))}
              />
            </div>
            <div className="w-10">
              <Wheel
                items={availableDays}
                value={String(day)}
                onChange={(v) => setDay(Number(v))}
              />
            </div>
            <div className="w-14">
              <Wheel
                items={availableYears}
                value={String(year)}
                onChange={(v) => setYear(Number(v))}
              />
            </div>
            <div className="w-3" />
          </>
        )}
        <div className="w-14">
          <Wheel
            items={hours}
            value={String(hour)}
            onChange={(v) => setHour(Number(v))}
          />
        </div>
        <div className="text-2xl font-bold text-gray-400">:</div>
        <div className="w-14">
          <Wheel
            items={minutes}
            value={String(minute).padStart(2, "0")}
            onChange={(v) => setMinute(Number(v))}
          />
        </div>
        <div className="flex flex-col gap-1 ml-1">
          <button
            onClick={() => setIsPM(false)}
            className={`px-2 py-2 rounded-lg font-medium text-sm transition-colors ${
              !isPM
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            }`}
          >
            AM
          </button>
          <button
            onClick={() => setIsPM(true)}
            className={`px-2 py-2 rounded-lg font-medium text-sm transition-colors ${
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
  );
}
