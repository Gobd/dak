import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Roller } from './Roller';

const meta: Meta<typeof Roller> = {
  title: 'Components/Roller',
  component: Roller,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Roller>;

function RollerDemo({ items, format }: { items: number[]; format?: (v: number) => string }) {
  const [value, setValue] = useState(items[Math.floor(items.length / 2)]);
  return (
    <div className="bg-surface-raised p-4 rounded-lg w-20">
      <Roller items={items} value={value} onChange={setValue} format={format} />
      <p className="text-xs text-text-muted mt-2 text-center">Value: {value}</p>
    </div>
  );
}

export const Hours: Story = {
  render: () => <RollerDemo items={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]} />,
};

export const Minutes: Story = {
  render: () => (
    <RollerDemo
      items={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
      format={(v) => String(v).padStart(2, '0')}
    />
  ),
};

export const Days: Story = {
  render: () => <RollerDemo items={Array.from({ length: 31 }, (_, i) => i + 1)} />,
};

export const CustomRange: Story = {
  render: () => (
    <RollerDemo items={Array.from({ length: 10 }, (_, i) => i * 10)} format={(v) => `${v}%`} />
  ),
};
