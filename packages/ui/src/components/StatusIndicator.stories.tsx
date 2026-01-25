import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator } from './StatusIndicator';

const meta: Meta<typeof StatusIndicator> = {
  title: 'Components/StatusIndicator',
  component: StatusIndicator,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['loading', 'error', 'success', 'idle'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusIndicator>;

export const Loading: Story = {
  args: { status: 'loading' },
};

export const LoadingWithMessage: Story = {
  args: { status: 'loading', message: 'Loading data...' },
};

export const Error: Story = {
  args: { status: 'error' },
};

export const ErrorWithMessage: Story = {
  args: { status: 'error', message: 'Failed to load data' },
};

export const Success: Story = {
  args: { status: 'success' },
};

export const SuccessWithMessage: Story = {
  args: { status: 'success', message: 'Data saved successfully' },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <StatusIndicator status="loading" message="Loading..." />
      <StatusIndicator status="success" message="Success!" />
      <StatusIndicator status="error" message="Error occurred" />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StatusIndicator status="loading" size="sm" />
      <StatusIndicator status="loading" size="md" />
      <StatusIndicator status="loading" size="lg" />
    </div>
  ),
};
