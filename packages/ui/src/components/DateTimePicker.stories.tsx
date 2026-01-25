import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DateTimePicker } from './DateTimePicker';

const meta: Meta<typeof DateTimePicker> = {
  title: 'Components/DateTimePicker',
  component: DateTimePicker,
  tags: ['autodocs'],
  argTypes: {
    showDatePicker: { control: 'boolean' },
    allowFuture: { control: 'boolean' },
    minuteStep: {
      control: 'select',
      options: [1, 5, 10, 15, 30],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DateTimePicker>;

function DateTimePickerDemo({
  showDatePicker = true,
  allowFuture = false,
  minuteStep = 5,
}: {
  showDatePicker?: boolean;
  allowFuture?: boolean;
  minuteStep?: number;
}) {
  const [date, setDate] = useState<Date | null>(new Date());
  return (
    <div>
      <p className="text-sm text-text-muted mb-2">Selected: {date?.toLocaleString() ?? 'None'}</p>
      <DateTimePicker
        value={date}
        onChange={setDate}
        showDatePicker={showDatePicker}
        allowFuture={allowFuture}
        minuteStep={minuteStep}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <DateTimePickerDemo />,
};

export const AllowFuture: Story = {
  render: () => <DateTimePickerDemo allowFuture />,
};

export const TimeOnly: Story = {
  render: () => <DateTimePickerDemo showDatePicker={false} />,
};

export const OneMinuteStep: Story = {
  render: () => <DateTimePickerDemo minuteStep={1} />,
};
