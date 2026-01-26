import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

const unitOptions = [
  { value: 'ml', label: 'ml' },
  { value: 'oz', label: 'oz' },
];

const viewOptions = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function UnitWrapper(props: { size?: 'sm' | 'md'; disabled?: boolean }) {
  const [value, setValue] = useState('ml');
  return <SegmentedControl options={unitOptions} value={value} onChange={setValue} {...props} />;
}

function ViewWrapper(props: { size?: 'sm' | 'md'; disabled?: boolean }) {
  const [value, setValue] = useState('week');
  return <SegmentedControl options={viewOptions} value={value} onChange={setValue} {...props} />;
}

export const Default: Story = {
  render: () => <UnitWrapper />,
};

export const ThreeOptions: Story = {
  render: () => <ViewWrapper />,
};

export const Small: Story = {
  render: () => <UnitWrapper size="sm" />,
};

export const Disabled: Story = {
  render: () => <UnitWrapper disabled />,
};
