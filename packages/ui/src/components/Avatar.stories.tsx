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
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const WithEmoji: Story = {
  args: { emoji: '🐱' },
};

export const WithInitials: Story = {
  args: { initials: 'JD' },
};

export const WithColor: Story = {
  args: { emoji: '🎨', color: '#4f46e5' },
};

export const Selected: Story = {
  args: { emoji: '⭐', color: '#f59e0b', selected: true },
};

export const Interactive: Story = {
  args: {
    emoji: '👋',
    color: '#10b981',
    onClick: () => alert('Avatar clicked!'),
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar emoji="🐱" size="xs" />
      <Avatar emoji="🐶" size="sm" />
      <Avatar emoji="🐰" size="md" />
      <Avatar emoji="🦊" size="lg" />
      <Avatar emoji="🐻" size="xl" />
    </div>
  ),
};

export const ColorPalette: Story = {
  render: () => (
    <div className="flex gap-2">
      <Avatar emoji="🔴" color="#ef4444" />
      <Avatar emoji="🟠" color="#f97316" />
      <Avatar emoji="🟡" color="#eab308" />
      <Avatar emoji="🟢" color="#22c55e" />
      <Avatar emoji="🔵" color="#3b82f6" />
      <Avatar emoji="🟣" color="#a855f7" />
    </div>
  ),
};
