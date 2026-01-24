import type { Meta, StoryObj } from '@storybook/react';
import { Center } from './Center';

const meta: Meta<typeof Center> = {
  title: 'Layout/Center',
  component: Center,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Center>;

export const Default: Story = {
  render: () => (
    <div className="h-40 border border-border rounded">
      <Center className="h-full">
        <span className="text-text">Centered content</span>
      </Center>
    </div>
  ),
};

export const WithCard: Story = {
  render: () => (
    <div className="h-60 bg-surface-sunken rounded-lg">
      <Center className="h-full">
        <div className="p-6 bg-surface-raised rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-text mb-2">Centered Card</h3>
          <p className="text-text-secondary">This card is perfectly centered.</p>
        </div>
      </Center>
    </div>
  ),
};

export const FullScreen: Story = {
  render: () => (
    <div className="h-96 bg-surface">
      <Center className="h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold text-text">Bullseye!</h1>
          <p className="text-text-secondary">Perfectly centered</p>
        </div>
      </Center>
    </div>
  ),
};
