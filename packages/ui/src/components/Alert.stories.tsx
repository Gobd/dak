import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['error', 'warning', 'success', 'info'],
    },
    icon: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Error: Story = {
  args: { children: 'Something went wrong', variant: 'error' },
};

export const Warning: Story = {
  args: { children: 'Please review before continuing', variant: 'warning' },
};

export const Success: Story = {
  args: { children: 'Changes saved successfully', variant: 'success' },
};

export const Info: Story = {
  args: { children: 'New features are available', variant: 'info' },
};

export const NoIcon: Story = {
  args: { children: 'Alert without icon', variant: 'info', icon: false },
};

export const Dismissible: Story = {
  args: {
    children: 'Click the X to dismiss',
    variant: 'warning',
    onDismiss: () => alert('Dismissed!'),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Alert variant="error">Error alert</Alert>
      <Alert variant="warning">Warning alert</Alert>
      <Alert variant="success">Success alert</Alert>
      <Alert variant="info">Info alert</Alert>
    </div>
  ),
};
