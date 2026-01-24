import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from './Stack';

const meta: Meta<typeof Stack> = {
  title: 'Layout/Stack',
  component: Stack,
  tags: ['autodocs'],
  argTypes: {
    gap: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Stack>;

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-2 bg-accent-light text-accent-dark rounded">{children}</div>
);

export const Default: Story = {
  render: () => (
    <Stack>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

export const SmallGap: Story = {
  render: () => (
    <Stack gap="sm">
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

export const LargeGap: Story = {
  render: () => (
    <Stack gap="lg">
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

export const CenterAligned: Story = {
  render: () => (
    <Stack align="center">
      <Box>Short</Box>
      <Box>Medium length</Box>
      <Box>A much longer item</Box>
    </Stack>
  ),
};

export const EndAligned: Story = {
  render: () => (
    <Stack align="end">
      <Box>Short</Box>
      <Box>Medium length</Box>
      <Box>A much longer item</Box>
    </Stack>
  ),
};
