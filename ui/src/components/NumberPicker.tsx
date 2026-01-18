import { useState } from 'react';
import { Roller } from './Roller';

interface NumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  zeroLabel?: string;
}

export function NumberPickerCompact({
  value,
  onChange,
  min = 0,
  max = 120,
  step = 1,
  suffix = 'min',
  zeroLabel = 'Off',
}: NumberPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Generate array of numbers from min to max with step
  const items = Array.from(
    { length: Math.floor((max - min) / step) + 1 },
    (_, i) => min + i * step
  );

  const displayValue = value === 0 && zeroLabel ? zeroLabel : `${value} ${suffix}`;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(true)}
        type="button"
        className="w-full p-2 rounded bg-gray-100 dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 text-left text-gray-900 dark:text-white"
      >
        {displayValue}
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-neutral-800 rounded-xl p-4">
              <div className="w-20">
                <Roller items={items} value={value} onChange={onChange} />
              </div>
              <div className="text-lg text-gray-500 dark:text-neutral-400">{suffix}</div>
            </div>

            <div className="flex gap-2 mt-4">
              {zeroLabel && (
                <button
                  onClick={() => {
                    onChange(0);
                    setShowPicker(false);
                  }}
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 text-gray-900 dark:text-white font-medium"
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
