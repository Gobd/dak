import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { NumberPickerCompact } from './NumberPicker';

const meta: Meta<typeof NumberPickerCompact> = {
  title: 'Components/NumberPicker',
  component: NumberPickerCompact,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NumberPickerCompact>;

function NumberPickerDemo({
  min = 0,
  max = 120,
  step = 5,
  suffix = 'min',
  zeroLabel = 'Off',
}: {
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  zeroLabel?: string;
}) {
  const [value, setValue] = useState(30);
  return (
    <div className="w-48">
      <NumberPickerCompact
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        zeroLabel={zeroLabel}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <NumberPickerDemo />,
};

export const Temperature: Story = {
  render: () => <NumberPickerDemo min={60} max={80} step={1} suffix="°F" zeroLabel="" />,
};

export const Percentage: Story = {
  render: () => <NumberPickerDemo min={0} max={100} step={10} suffix="%" zeroLabel="None" />,
};

export const Hours: Story = {
  render: () => <NumberPickerDemo min={1} max={12} step={1} suffix="hr" zeroLabel="" />,
};
