import type { Meta, StoryObj } from '@storybook/react';
import { ErrorCard } from './ErrorCard';

const meta: Meta<typeof ErrorCard> = {
  title: 'Components/ErrorCard',
  component: ErrorCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorCard>;

export const Default: Story = {
  args: {
    message: 'Something went wrong',
  },
};

export const WithDetails: Story = {
  args: {
    message: 'Failed to load data',
    details: 'The server returned an unexpected response. Please try again later.',
  },
};

export const WithRetry: Story = {
  args: {
    message: 'Connection failed',
    details: 'Unable to connect to the server.',
    onRetry: () => alert('Retrying...'),
  },
};

export const NetworkError: Story = {
  args: {
    message: 'Network error',
    details: 'Please check your internet connection and try again.',
    onRetry: () => alert('Retrying...'),
  },
};
