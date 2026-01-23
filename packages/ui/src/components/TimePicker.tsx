import { useState, useMemo } from 'react';
import { Roller } from './Roller';

interface TimePickerProps {
  value: string; // "HH:MM" 24-hour format
  onChange: (value: string) => void;
  minuteStep?: number; // Default 5, can be 1 for precise selection
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function generateMinutes(step: number): number[] {
  const minutes: number[] = [];
  for (let i = 0; i < 60; i += step) {
    minutes.push(i);
  }
  return minutes;
}

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

function AMPMToggle({ value, onChange }: { value: boolean; onChange: (isPM: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
          !value ? 'bg-accent text-text' : 'bg-surface-sunken text-text-secondary text-text-muted'
        }`}
      >
        AM
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
          value ? 'bg-accent text-text' : 'bg-surface-sunken text-text-secondary text-text-muted'
        }`}
      >
        PM
      </button>
    </div>
  );
}

export function TimePicker({ value, onChange, minuteStep = 5 }: TimePickerProps) {
  const minutes = useMemo(() => generateMinutes(minuteStep), [minuteStep]);

  // Fully controlled - derive state from props
  const { hour, minute, isPM } = parseTime(value);

  // Find closest minute in our options
  const closestMinute = minutes.reduce((prev, curr) =>
    Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev,
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
    <div className="flex items-center justify-center gap-2 bg-surface-raised rounded-xl p-4">
      <div className="w-16">
        <Roller items={HOURS} value={hour} onChange={handleHourChange} />
      </div>

      <div className="text-3xl font-bold text-text-muted">:</div>

      <div className="w-16">
        <Roller
          items={minutes}
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
export function TimePickerCompact({ value, onChange, minuteStep = 5 }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const parsed = parseTime(value);

  const displayTime = `${parsed.hour}:${String(parsed.minute).padStart(2, '0')} ${parsed.isPM ? 'PM' : 'AM'}`;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(true)}
        type="button"
        className="w-full p-2 rounded bg-surface-sunken border border-border text-left text-text"
      >
        {displayTime}
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-xl p-4 shadow-2xl">
            <TimePicker value={value} onChange={onChange} minuteStep={minuteStep} />
            <button
              onClick={() => setShowPicker(false)}
              type="button"
              className="w-full mt-4 px-4 py-2 rounded-lg bg-accent text-text font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
