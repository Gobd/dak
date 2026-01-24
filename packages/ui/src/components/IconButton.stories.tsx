import type { Meta, StoryObj } from '@storybook/react';
import { Settings, Trash2, Plus, Bell } from 'lucide-react';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'danger', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    badgeVariant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    icon: <Settings className="w-full h-full" />,
    label: 'Settings',
  },
};

export const Primary: Story = {
  args: {
    icon: <Plus className="w-full h-full" />,
    label: 'Add',
    variant: 'primary',
  },
};

export const Danger: Story = {
  args: {
    icon: <Trash2 className="w-full h-full" />,
    label: 'Delete',
    variant: 'danger',
  },
};

export const Ghost: Story = {
  args: {
    icon: <Settings className="w-full h-full" />,
    label: 'Settings',
    variant: 'ghost',
  },
};

export const Loading: Story = {
  args: {
    icon: <Settings className="w-full h-full" />,
    label: 'Loading...',
    loading: true,
  },
};

export const WithBadge: Story = {
  args: {
    icon: <Bell className="w-full h-full" />,
    label: 'Notifications',
    badge: 5,
  },
};

export const WithDangerBadge: Story = {
  args: {
    icon: <Bell className="w-full h-full" />,
    label: 'Alerts',
    badge: 3,
    badgeVariant: 'danger',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <IconButton icon={<Settings className="w-full h-full" />} label="Small" size="sm" />
      <IconButton icon={<Settings className="w-full h-full" />} label="Medium" size="md" />
      <IconButton icon={<Settings className="w-full h-full" />} label="Large" size="lg" />
    </div>
  ),
};
