import type { Meta, StoryObj } from '@storybook/react';
import { ToastContainer } from './Toast';
import { useToastStore } from '../stores/toast-store';
import { Button } from './Button';
import { useEffect } from 'react';

const meta: Meta<typeof ToastContainer> = {
  title: 'Components/Toast',
  component: ToastContainer,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[200px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ToastContainer>;

function ToastDemo() {
  const { showToast } = useToastStore();

  return (
    <div className="flex flex-col gap-2">
      <ToastContainer />
      <div className="flex gap-2">
        <Button onClick={() => showToast('Operation completed successfully', 'success')}>
          Success Toast
        </Button>
        <Button onClick={() => showToast('Something went wrong', 'error')} variant="danger">
          Error Toast
        </Button>
        <Button onClick={() => showToast('Here is some information', 'info')} variant="secondary">
          Info Toast
        </Button>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <ToastDemo />,
};

function PreloadedToasts() {
  const { showToast } = useToastStore();

  useEffect(() => {
    showToast('Success message', 'success');
    setTimeout(() => showToast('Error message', 'error'), 100);
    setTimeout(() => showToast('Info message', 'info'), 200);
  }, [showToast]);

  return <ToastContainer />;
}

export const AllVariants: Story = {
  render: () => <PreloadedToasts />,
};
