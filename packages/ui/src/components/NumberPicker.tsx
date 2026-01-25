import { useState } from 'react';
import { Roller } from './Roller';
import { Button } from './Button';

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
    (_, i) => min + i * step,
  );

  const displayValue = value === 0 && zeroLabel ? zeroLabel : `${value} ${suffix}`;

  return (
    <div className="relative">
      <Button
        variant="secondary"
        onClick={() => setShowPicker(true)}
        className="w-full justify-start"
      >
        {displayValue}
      </Button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2 bg-surface-raised rounded-xl p-4">
              <div className="w-20">
                <Roller items={items} value={value} onChange={onChange} />
              </div>
              <div className="text-lg text-text-muted">{suffix}</div>
            </div>

            <div className="flex gap-2 mt-4">
              {zeroLabel && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onChange(0);
                    setShowPicker(false);
                  }}
                  className="flex-1"
                >
                  {zeroLabel}
                </Button>
              )}
              <Button variant="primary" onClick={() => setShowPicker(false)} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
