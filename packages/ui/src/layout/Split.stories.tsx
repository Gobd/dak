import type { Meta, StoryObj } from '@storybook/react';
import { Split } from './Split';
import { Button } from '../components/Button';

const meta: Meta<typeof Split> = {
  title: 'Layout/Split',
  component: Split,
  tags: ['autodocs'],
  argTypes: {
    gap: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Split>;

export const Default: Story = {
  render: () => (
    <Split>
      <span className="text-text">Left side</span>
      <span className="text-text">Right side</span>
    </Split>
  ),
};

export const HeaderWithActions: Story = {
  render: () => (
    <Split>
      <h2 className="text-lg font-semibold text-text">Page Title</h2>
      <Button variant="primary">Action</Button>
    </Split>
  ),
};

export const ListItem: Story = {
  render: () => (
    <div className="p-4 bg-surface-raised rounded-lg">
      <Split>
        <div>
          <h3 className="font-medium text-text">List Item Title</h3>
          <p className="text-sm text-text-secondary">Description text</p>
        </div>
        <span className="text-text-muted text-sm">2h ago</span>
      </Split>
    </div>
  ),
};

export const TopAligned: Story = {
  render: () => (
    <div className="p-4 bg-surface-raised rounded-lg">
      <Split align="start">
        <div>
          <h3 className="font-medium text-text">Longer Content</h3>
          <p className="text-sm text-text-secondary">Line 1</p>
          <p className="text-sm text-text-secondary">Line 2</p>
          <p className="text-sm text-text-secondary">Line 3</p>
        </div>
        <Button>Action</Button>
      </Split>
    </div>
  ),
};

export const FormRow: Story = {
  render: () => (
    <Split>
      <label className="text-text font-medium">Setting Name</label>
      <input
        type="text"
        className="px-3 py-1 rounded border border-border bg-surface text-text"
        defaultValue="Value"
      />
    </Split>
  ),
};
