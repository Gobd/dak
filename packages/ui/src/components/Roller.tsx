import { WheelPicker } from '@ncdai/react-wheel-picker';
import { useMemo } from 'react';

interface RollerProps {
  items: number[];
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

export function Roller({ items, value, onChange, format = (v) => String(v) }: RollerProps) {
  // Convert items array to options format
  const options = useMemo(
    () => items.map((item) => ({ value: item, label: format(item) })),
    [items, format]
  );

  return (
    <div className="roller-wrapper">
      <WheelPicker
        options={options}
        value={value}
        onValueChange={onChange}
        infinite
        optionItemHeight={36}
        visibleCount={11}
        dragSensitivity={2}
        scrollSensitivity={3}
      />
    </div>
  );
}
