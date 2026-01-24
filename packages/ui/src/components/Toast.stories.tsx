import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { createToastStore, ToastContainer } from './Toast';
import { Button } from './Button';

const meta: Meta = {
  title: 'Components/Toast',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

// Create a store for the stories
const useToastStore = createToastStore();

function ToastDemo() {
  const { toasts, show, dismiss } = useToastStore();

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => show({ message: 'Default toast notification' })}>Show Default</Button>
      <Button
        variant="primary"
        onClick={() => show({ message: 'Operation completed!', variant: 'success' })}
      >
        Show Success
      </Button>
      <Button
        variant="danger"
        onClick={() => show({ message: 'Something went wrong', variant: 'error' })}
      >
        Show Error
      </Button>
      <Button onClick={() => show({ message: 'Please check your input', variant: 'warning' })}>
        Show Warning
      </Button>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <ToastDemo />,
};

function PersistentToastDemo() {
  const { toasts, show, dismiss } = useToastStore();

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => show({ message: 'This toast stays until dismissed', duration: 0 })}>
        Persistent Toast
      </Button>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export const Persistent: Story = {
  render: () => <PersistentToastDemo />,
};

// Static preview of toast variants
function ToastPreview() {
  const { toasts, show, dismiss } = useToastStore();

  useEffect(() => {
    show({ message: 'Default notification', duration: 0 });
    show({ message: 'Success message!', variant: 'success', duration: 0 });
    show({ message: 'Warning: Check your input', variant: 'warning', duration: 0 });
    show({ message: 'Error: Operation failed', variant: 'error', duration: 0 });
  }, [show]);

  return <ToastContainer toasts={toasts} onDismiss={dismiss} />;
}

export const AllVariants: Story = {
  render: () => <ToastPreview />,
};
