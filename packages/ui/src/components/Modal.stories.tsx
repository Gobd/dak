import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';
import { Button } from './Button';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    wide: { control: 'boolean' },
    fit: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

function ModalDemo({
  title,
  wide,
  fit,
  children,
}: {
  title?: string;
  wide?: boolean;
  fit?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        wide={wide}
        fit={fit}
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        {children}
      </Modal>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <ModalDemo title="Modal Title">
      <p>This is the modal content. You can put any content here.</p>
    </ModalDemo>
  ),
};

export const Wide: Story = {
  render: () => (
    <ModalDemo title="Wide Modal" wide>
      <p>This modal uses the wide prop for more content space.</p>
      <p className="mt-2">Great for forms with multiple columns or detailed content.</p>
    </ModalDemo>
  ),
};

export const FitContent: Story = {
  render: () => (
    <ModalDemo title="Fit Content" fit>
      <p>Fits to content width</p>
    </ModalDemo>
  ),
};

export const NoTitle: Story = {
  render: () => (
    <ModalDemo>
      <p>This modal has no title bar, just content.</p>
    </ModalDemo>
  ),
};
