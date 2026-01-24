import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger', 'info', 'feature'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Default' },
};

export const Success: Story = {
  args: { children: 'Completed', variant: 'success' },
};

export const Warning: Story = {
  args: { children: 'Pending', variant: 'warning' },
};

export const Danger: Story = {
  args: { children: 'Failed', variant: 'danger' },
};

export const Info: Story = {
  args: { children: 'Info', variant: 'info' },
};

export const Feature: Story = {
  args: { children: 'New', variant: 'feature' },
};

export const Small: Story = {
  args: { children: 'Small', size: 'sm' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="feature">Feature</Badge>
    </div>
  ),
};
