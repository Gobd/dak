import type { Meta, StoryObj } from '@storybook/react';
import { ProgressRing } from './ProgressRing';

const meta: Meta<typeof ProgressRing> = {
  title: 'Components/ProgressRing',
  component: ProgressRing,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressRing>;

export const Default: Story = {
  args: { value: 65 },
};

export const WithValue: Story = {
  args: { value: 75, showValue: true },
};

export const ColorByProgress: Story = {
  args: { value: 45, colorByProgress: true, showValue: true },
};

export const Complete: Story = {
  args: { value: 100, colorByProgress: true, showValue: true },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ProgressRing value={60} size="sm" showValue />
      <ProgressRing value={60} size="md" showValue />
      <ProgressRing value={60} size="lg" showValue />
    </div>
  ),
};

export const ProgressStages: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ProgressRing value={25} colorByProgress showValue />
      <ProgressRing value={50} colorByProgress showValue />
      <ProgressRing value={75} colorByProgress showValue />
      <ProgressRing value={100} colorByProgress showValue />
    </div>
  ),
};

export const CustomMax: Story = {
  args: { value: 3, max: 5, showValue: true },
};
