import type { Meta, StoryObj } from '@storybook/react';
import { Cluster } from './Cluster';
import { Badge } from '../components/Badge';

const meta: Meta<typeof Cluster> = {
  title: 'Layout/Cluster',
  component: Cluster,
  tags: ['autodocs'],
  argTypes: {
    gap: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'baseline'],
    },
    wrap: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Cluster>;

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-2 bg-accent-light text-accent-dark rounded">{children}</div>
);

export const Default: Story = {
  render: () => (
    <Cluster>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Cluster>
  ),
};

export const SmallGap: Story = {
  render: () => (
    <Cluster gap="sm">
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Cluster>
  ),
};

export const JustifyBetween: Story = {
  render: () => (
    <Cluster justify="between" className="w-full">
      <Box>Left</Box>
      <Box>Right</Box>
    </Cluster>
  ),
};

export const Center: Story = {
  render: () => (
    <Cluster justify="center" className="w-full">
      <Box>Centered 1</Box>
      <Box>Centered 2</Box>
    </Cluster>
  ),
};

export const TagList: Story = {
  render: () => (
    <Cluster gap="sm">
      <Badge>React</Badge>
      <Badge>TypeScript</Badge>
      <Badge>Tailwind</Badge>
      <Badge>Vite</Badge>
      <Badge>Storybook</Badge>
    </Cluster>
  ),
};

export const WrapEnabled: Story = {
  render: () => (
    <div className="max-w-xs">
      <Cluster gap="sm" wrap>
        <Badge>Tag 1</Badge>
        <Badge>Tag 2</Badge>
        <Badge>Tag 3</Badge>
        <Badge>Tag 4</Badge>
        <Badge>Tag 5</Badge>
        <Badge>Tag 6</Badge>
        <Badge>Tag 7</Badge>
      </Cluster>
    </div>
  ),
};

export const NoWrap: Story = {
  render: () => (
    <div className="max-w-xs overflow-hidden">
      <Cluster gap="sm" wrap={false}>
        <Badge>Tag 1</Badge>
        <Badge>Tag 2</Badge>
        <Badge>Tag 3</Badge>
        <Badge>Tag 4</Badge>
        <Badge>Tag 5</Badge>
      </Cluster>
    </div>
  ),
};
