import { useRef, useEffect, useState } from "react";
import { format } from "date-fns";

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
  showYesterday?: boolean;
}

export function TimePicker({
  value,
  onChange,
  showYesterday = true,
}: TimePickerProps) {
  const now = new Date();
  const baseDate = value || now;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [isYesterday, setIsYesterday] = useState(false);
  const [hour, setHour] = useState(() => {
    const h = baseDate.getHours();
    return h === 0 ? 12 : h > 12 ? h - 12 : h;
  });
  const [minute, setMinute] = useState(() => {
    return Math.floor(baseDate.getMinutes() / 5) * 5;
  });
  const [isPM, setIsPM] = useState(() => baseDate.getHours() >= 12);

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0"),
  );

  useEffect(() => {
    const date = new Date();
    if (isYesterday) {
      date.setDate(date.getDate() - 1);
    }

    let h = hour;
    if (isPM && hour !== 12) h = hour + 12;
    if (!isPM && hour === 12) h = 0;

    date.setHours(h, minute, 0, 0);
    onChange(date);
  }, [hour, minute, isPM, isYesterday, onChange]);

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 space-y-4">
      {showYesterday && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setIsYesterday(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !isYesterday
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            }`}
          >
            Today ({format(today, "MMM d")})
          </button>
          <button
            onClick={() => setIsYesterday(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isYesterday
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            }`}
          >
            Yesterday ({format(yesterday, "MMM d")})
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <div className="w-16">
          <Wheel
            items={hours}
            value={String(hour)}
            onChange={(v) => setHour(Number(v))}
          />
        </div>
        <div className="text-2xl font-bold text-gray-400">:</div>
        <div className="w-16">
          <Wheel
            items={minutes}
            value={String(minute).padStart(2, "0")}
            onChange={(v) => setMinute(Number(v))}
          />
        </div>
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={() => setIsPM(false)}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              !isPM
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            }`}
          >
            AM
          </button>
          <button
            onClick={() => setIsPM(true)}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
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
