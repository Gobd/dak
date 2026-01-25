import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ConfirmModal } from './ConfirmModal';
import { Button } from './Button';

const meta: Meta<typeof ConfirmModal> = {
  title: 'Components/ConfirmModal',
  component: ConfirmModal,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['danger', 'primary'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmModal>;

function ConfirmDemo({
  title,
  message,
  variant,
  confirmText,
}: {
  title?: string;
  message: string;
  variant?: 'danger' | 'primary';
  confirmText?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Show Confirm</Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => alert('Confirmed!')}
        title={title}
        message={message}
        variant={variant}
        confirmText={confirmText}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <ConfirmDemo title="Confirm Action" message="Are you sure you want to proceed?" />,
};

export const Danger: Story = {
  render: () => (
    <ConfirmDemo
      title="Delete Item"
      message="This action cannot be undone. Are you sure?"
      variant="danger"
      confirmText="Delete"
    />
  ),
};

export const Primary: Story = {
  render: () => (
    <ConfirmDemo
      title="Save Changes"
      message="Do you want to save your changes?"
      variant="primary"
      confirmText="Save"
    />
  ),
};
