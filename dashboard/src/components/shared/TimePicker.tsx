import { useState, useRef, useEffect, useCallback } from 'react';

interface TimePickerProps {
  value: string; // "HH:MM" 24-hour format
  onChange: (value: string) => void;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parseTime(value: string): { hour: number; minute: number; isPM: boolean } {
  const [h, m] = value.split(':').map(Number);
  const hour24 = h || 0;
  const minute = m || 0;
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour: hour12, minute, isPM };
}

function formatTime(hour12: number, minute: number, isPM: boolean): string {
  let hour24 = hour12;
  if (isPM && hour12 !== 12) hour24 = hour12 + 12;
  if (!isPM && hour12 === 12) hour24 = 0;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface RollerProps {
  items: number[];
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

function Roller({ items, value, onChange, format = (v) => String(v) }: RollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 44;
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Create circular array: [...items, ...items, ...items]
  const circularItems = [...items, ...items, ...items];
  const middleOffset = items.length;

  const currentIndex = items.indexOf(value);
  const targetIndex = currentIndex + middleOffset;

  // Scroll to current value on mount and when value changes externally
  useEffect(() => {
    if (containerRef.current && !isScrolling.current) {
      containerRef.current.scrollTop = targetIndex * itemHeight;
    }
  }, [targetIndex, itemHeight]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    isScrolling.current = true;

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    // Debounce the scroll end detection
    scrollTimeout.current = setTimeout(() => {
      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const actualIndex = ((index % items.length) + items.length) % items.length;
      const newValue = items[actualIndex];

      // Reset to middle section for infinite scroll
      const middleIndex = actualIndex + middleOffset;
      if (index < middleOffset / 2 || index >= middleOffset + items.length + middleOffset / 2) {
        containerRef.current.scrollTop = middleIndex * itemHeight;
      }

      if (newValue !== value) {
        onChange(newValue);
      }

      isScrolling.current = false;
    }, 100);
  }, [items, value, onChange, itemHeight, middleOffset]);

  return (
    <div className="relative h-[132px] overflow-hidden">
      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-neutral-800 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-neutral-800 to-transparent z-10 pointer-events-none" />

      {/* Selection highlight */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 bg-neutral-700/50 rounded-lg pointer-events-none" />

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Padding for centering */}
        <div style={{ height: itemHeight }} />

        {circularItems.map((item, i) => (
          <div
            key={i}
            className="h-11 flex items-center justify-center text-2xl font-medium snap-center cursor-pointer"
            onClick={() => {
              const actualIndex = i % items.length;
              onChange(items[actualIndex]);
            }}
          >
            {format(item)}
          </div>
        ))}

        {/* Padding for centering */}
        <div style={{ height: itemHeight }} />
      </div>
    </div>
  );
}

function AMPMToggle({ value, onChange }: { value: boolean; onChange: (isPM: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => onChange(false)}
        className={`px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
          !value ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-400'
        }`}
      >
        AM
      </button>
      <button
        onClick={() => onChange(true)}
        className={`px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
          value ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-400'
        }`}
      >
        PM
      </button>
    </div>
  );
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  // Fully controlled - derive state from props
  const { hour, minute, isPM } = parseTime(value);

  // Find closest minute in our options
  const closestMinute = MINUTES.reduce((prev, curr) =>
    Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev
  );

  function handleHourChange(newHour: number) {
    onChange(formatTime(newHour, minute, isPM));
  }

  function handleMinuteChange(newMinute: number) {
    onChange(formatTime(hour, newMinute, isPM));
  }

  function handleAMPMChange(newIsPM: boolean) {
    onChange(formatTime(hour, minute, newIsPM));
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-neutral-800 rounded-xl p-4">
      <div className="w-16">
        <Roller
          items={HOURS}
          value={hour}
          onChange={handleHourChange}
        />
      </div>

      <div className="text-3xl font-bold text-neutral-500">:</div>

      <div className="w-16">
        <Roller
          items={MINUTES}
          value={closestMinute}
          onChange={handleMinuteChange}
          format={(v) => String(v).padStart(2, '0')}
        />
      </div>

      <div className="ml-2">
        <AMPMToggle value={isPM} onChange={handleAMPMChange} />
      </div>
    </div>
  );
}

// Compact version for inline use
export function TimePickerCompact({ value, onChange }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const parsed = parseTime(value);

  const displayTime = `${parsed.hour}:${String(parsed.minute).padStart(2, '0')} ${parsed.isPM ? 'PM' : 'AM'}`;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(true)}
        className="w-full p-2 rounded bg-neutral-700 border border-neutral-600 text-left"
      >
        {displayTime}
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 rounded-xl p-4 shadow-2xl">
            <TimePicker value={value} onChange={onChange} />
            <button
              onClick={() => setShowPicker(false)}
              className="w-full mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
