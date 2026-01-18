import { useRef, useEffect, useCallback } from 'react';

const ITEM_HEIGHT = 44;

interface RollerProps {
  items: number[];
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

export function Roller({ items, value, onChange, format = (v) => String(v) }: RollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Create circular array: [...items, ...items, ...items]
  const circularItems = [...items, ...items, ...items];
  const middleOffset = items.length;

  const currentIndex = items.indexOf(value);
  const targetIndex = currentIndex >= 0 ? currentIndex + middleOffset : middleOffset;

  // Scroll to current value on mount and when value changes externally
  useEffect(() => {
    if (containerRef.current && !isScrolling.current) {
      containerRef.current.scrollTop = targetIndex * ITEM_HEIGHT;
    }
  }, [targetIndex]);

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
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const actualIndex = ((index % items.length) + items.length) % items.length;
      const newValue = items[actualIndex];

      // Reset to middle section for infinite scroll
      const middleIndex = actualIndex + middleOffset;
      if (index < middleOffset / 2 || index >= middleOffset + items.length + middleOffset / 2) {
        containerRef.current.scrollTop = middleIndex * ITEM_HEIGHT;
      }

      if (newValue !== value) {
        onChange(newValue);
      }

      isScrolling.current = false;
    }, 100);
  }, [items, value, onChange, middleOffset]);

  return (
    <div className="relative h-[132px] overflow-hidden">
      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-white dark:from-neutral-800 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-white dark:from-neutral-800 to-transparent z-10 pointer-events-none" />

      {/* Selection highlight */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 bg-blue-500/10 border-y border-blue-500/30 rounded-lg pointer-events-none" />

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Padding for centering */}
        <div style={{ height: ITEM_HEIGHT }} />

        {circularItems.map((item, i) => (
          <div
            key={i}
            className="h-11 flex items-center justify-center text-xl font-medium snap-center cursor-pointer"
            onClick={() => {
              const actualIndex = i % items.length;
              onChange(items[actualIndex]);
            }}
          >
            <span
              className={
                item === value
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-neutral-500'
              }
            >
              {format(item)}
            </span>
          </div>
        ))}

        {/* Padding for centering */}
        <div style={{ height: ITEM_HEIGHT }} />
      </div>
    </div>
  );
}
