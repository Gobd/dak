import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    showName: { control: 'boolean' },
    selected: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: { name: 'John Doe' },
};

export const WithEmoji: Story = {
  args: { name: 'Alice', emoji: '🦊' },
};

export const WithCustomColor: Story = {
  args: { name: 'Bob', color: '#8B5CF6' },
};

export const WithName: Story = {
  args: { name: 'Charlie', showName: true },
};

export const Selected: Story = {
  args: { name: 'Diana', selected: true },
};

export const Clickable: Story = {
  args: { name: 'Eve', onClick: () => alert('Clicked!') },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <Avatar name="XS" size="xs" />
      <Avatar name="SM" size="sm" />
      <Avatar name="MD" size="md" />
      <Avatar name="LG" size="lg" />
      <Avatar name="XL" size="xl" />
    </div>
  ),
};
