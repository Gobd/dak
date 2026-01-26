import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'raised', 'sunken'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { children: 'Default card with border', variant: 'default' },
};

export const Raised: Story = {
  args: { children: 'Raised card (default)', variant: 'raised' },
};

export const Sunken: Story = {
  args: { children: 'Sunken card', variant: 'sunken' },
};

export const PaddingSm: Story = {
  args: { children: 'Small padding', padding: 'sm' },
};

export const PaddingLg: Story = {
  args: { children: 'Large padding', padding: 'lg' },
};

export const NoPadding: Story = {
  args: { children: 'No padding', padding: 'none' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Card variant="default">Default (bordered)</Card>
      <Card variant="raised">Raised</Card>
      <Card variant="sunken">Sunken</Card>
    </div>
  ),
};
