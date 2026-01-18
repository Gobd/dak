import { useState, useRef, useCallback, useEffect } from 'react';

interface NumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  zeroLabel?: string;
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
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Create circular array for infinite scroll
  const circularItems = [...items, ...items, ...items];
  const middleOffset = items.length;

  const currentIndex = items.indexOf(value);
  const targetIndex = currentIndex >= 0 ? currentIndex + middleOffset : middleOffset;

  useEffect(() => {
    if (containerRef.current && !isScrolling.current) {
      containerRef.current.scrollTop = targetIndex * itemHeight;
    }
  }, [targetIndex, itemHeight]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    isScrolling.current = true;

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

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

        <div style={{ height: itemHeight }} />
      </div>
    </div>
  );
}

export function NumberPickerCompact({
  value,
  onChange,
  min = 0,
  max = 120,
  suffix = 'min',
  zeroLabel = 'Off',
}: NumberPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Generate array of numbers from min to max
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const displayValue = value === 0 && zeroLabel ? zeroLabel : `${value} ${suffix}`;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(true)}
        type="button"
        className="w-full p-2 rounded bg-neutral-700 border border-neutral-600 text-left"
      >
        {displayValue}
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2 bg-neutral-800 rounded-xl p-4">
              <div className="w-20">
                <Roller items={items} value={value} onChange={onChange} />
              </div>
              <div className="text-lg text-neutral-400">{suffix}</div>
            </div>

            <div className="flex gap-2 mt-4">
              {zeroLabel && (
                <button
                  onClick={() => {
                    onChange(0);
                    setShowPicker(false);
                  }}
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg bg-neutral-700 text-white font-medium"
                >
                  {zeroLabel}
                </button>
              )}
              <button
                onClick={() => setShowPicker(false)}
                type="button"
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
