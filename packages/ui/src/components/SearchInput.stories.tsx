import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchInput } from './SearchInput';

const meta: Meta<typeof SearchInput> = {
  title: 'Components/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SearchInput>;

// Interactive wrapper for controlled component
function SearchWrapper(props: Partial<Parameters<typeof SearchInput>[0]>) {
  const [value, setValue] = useState(props.value ?? '');
  return <SearchInput {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: () => <SearchWrapper />,
};

export const WithPlaceholder: Story = {
  render: () => <SearchWrapper placeholder="Search notes..." />,
};

export const WithValue: Story = {
  render: () => <SearchWrapper value="React hooks" />,
};

export const AutoFocus: Story = {
  render: () => <SearchWrapper autoFocus placeholder="Start typing..." />,
};

export const CustomWidth: Story = {
  render: () => <SearchWrapper className="max-w-xs" placeholder="Narrow search" />,
};
