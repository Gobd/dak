import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['raised', 'sunken', 'outlined'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Raised: Story = {
  args: {
    children: 'This is a raised card with default padding.',
    variant: 'raised',
  },
};

export const Sunken: Story = {
  args: {
    children: 'This is a sunken card.',
    variant: 'sunken',
  },
};

export const Outlined: Story = {
  args: {
    children: 'This is an outlined card.',
    variant: 'outlined',
  },
};

export const WithHeader: Story = {
  args: {
    header: 'Card Header',
    children: 'Card content goes here.',
  },
};

export const WithHeaderAndFooter: Story = {
  args: {
    header: 'Card Header',
    children: 'Card content with both header and footer.',
    footer: <span className="text-text-secondary text-sm">Footer content</span>,
  },
};

export const NoPadding: Story = {
  args: {
    padding: 'none',
    children: <div className="p-4 bg-accent-light">Custom padded content</div>,
  },
};
