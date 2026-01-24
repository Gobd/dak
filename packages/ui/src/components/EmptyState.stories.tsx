import type { Meta, StoryObj } from '@storybook/react';
import { FileText, Search, Users } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'No items found',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'No notes yet',
    description: 'Create your first note to get started.',
  },
};

export const WithCustomIcon: Story = {
  args: {
    icon: <FileText className="w-full h-full" />,
    title: 'No documents',
    description: 'Upload a document to begin.',
  },
};

export const WithAction: Story = {
  args: {
    icon: <Users className="w-full h-full" />,
    title: 'No team members',
    description: 'Invite your team to collaborate.',
    action: <Button variant="primary">Invite members</Button>,
  },
};

export const SearchResults: Story = {
  args: {
    icon: <Search className="w-full h-full" />,
    title: 'No results found',
    description: 'Try adjusting your search terms.',
  },
};
