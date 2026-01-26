import type { Meta, StoryObj } from '@storybook/react';
import { Chip } from './Chip';

const meta: Meta<typeof Chip> = {
  title: 'Components/Chip',
  component: Chip,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'selected', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: { children: 'Default' },
};

export const Selected: Story = {
  args: { children: 'Selected', variant: 'selected' },
};

export const Outline: Story = {
  args: { children: 'Outline', variant: 'outline' },
};

export const Small: Story = {
  args: { children: 'Small', size: 'sm' },
};

export const Removable: Story = {
  args: {
    children: 'Removable',
    onRemove: () => alert('Removed!'),
  },
};

export const CustomColor: Story = {
  args: { children: 'Custom Color', color: '#8b5cf6' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Chip variant="default">Default</Chip>
      <Chip variant="selected">Selected</Chip>
      <Chip variant="outline">Outline</Chip>
      <Chip size="sm">Small</Chip>
      <Chip color="#22c55e">Green</Chip>
      <Chip color="#f59e0b">Orange</Chip>
    </div>
  ),
};
