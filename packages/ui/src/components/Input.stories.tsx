import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
};

export const WithLabel: Story = {
  args: { label: 'Email', placeholder: 'you@example.com', type: 'email' },
};

export const WithError: Story = {
  args: { label: 'Password', type: 'password', error: 'Password is required' },
};

export const Disabled: Story = {
  args: { label: 'Disabled', value: 'Cannot edit', disabled: true },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm">
      <Input placeholder="Default state" />
      <Input label="With label" placeholder="Labeled input" />
      <Input label="With error" error="This field is required" />
      <Input label="Disabled" value="Read only" disabled />
    </div>
  ),
};
