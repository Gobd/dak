import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TimePickerCompact } from './TimePicker';

const meta: Meta<typeof TimePickerCompact> = {
  title: 'Components/TimePicker',
  component: TimePickerCompact,
  tags: ['autodocs'],
  argTypes: {
    minuteStep: {
      control: 'select',
      options: [1, 5, 10, 15, 30],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TimePickerCompact>;

function TimePickerDemo({ minuteStep = 5 }: { minuteStep?: number }) {
  const [time, setTime] = useState('14:30');
  return (
    <div className="w-48">
      <p className="text-sm text-text-muted mb-2">Value: {time}</p>
      <TimePickerCompact value={time} onChange={setTime} minuteStep={minuteStep} />
    </div>
  );
}

export const Default: Story = {
  render: () => <TimePickerDemo />,
};

export const OneMinuteStep: Story = {
  render: () => <TimePickerDemo minuteStep={1} />,
};

export const FifteenMinuteStep: Story = {
  render: () => <TimePickerDemo minuteStep={15} />,
};

export const ThirtyMinuteStep: Story = {
  render: () => <TimePickerDemo minuteStep={30} />,
};
