import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DatePicker, DatePickerCompact } from './DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'Components/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  argTypes: {
    allowFuture: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

function DatePickerDemo({ allowFuture = true }: { allowFuture?: boolean }) {
  const [date, setDate] = useState(new Date());
  return (
    <div>
      <p className="text-sm text-text-muted mb-2">Selected: {date.toLocaleDateString()}</p>
      <DatePicker value={date} onChange={setDate} allowFuture={allowFuture} />
    </div>
  );
}

function DatePickerCompactDemo({ allowFuture = true }: { allowFuture?: boolean }) {
  const [date, setDate] = useState(new Date());
  return (
    <div className="w-48">
      <DatePickerCompact value={date} onChange={setDate} allowFuture={allowFuture} />
    </div>
  );
}

export const Default: Story = {
  render: () => <DatePickerDemo />,
};

export const NoFutureDates: Story = {
  render: () => <DatePickerDemo allowFuture={false} />,
};

export const Compact: Story = {
  render: () => <DatePickerCompactDemo />,
};

export const CompactNoFuture: Story = {
  render: () => <DatePickerCompactDemo allowFuture={false} />,
};
