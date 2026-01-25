import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Components/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

// Interactive wrapper for controlled component
function ToggleWrapper(props: Partial<Parameters<typeof Toggle>[0]>) {
  const [checked, setChecked] = useState(props.checked ?? false);
  return <Toggle {...props} checked={checked} onChange={setChecked} />;
}

export const Default: Story = {
  render: () => <ToggleWrapper />,
};

export const Checked: Story = {
  render: () => <ToggleWrapper checked />,
};

export const WithLabel: Story = {
  render: () => <ToggleWrapper label="Enable notifications" />,
};

export const Small: Story = {
  render: () => <ToggleWrapper size="sm" label="Small toggle" />,
};

export const Disabled: Story = {
  render: () => <ToggleWrapper disabled label="Disabled toggle" />,
};

export const DisabledChecked: Story = {
  render: () => <ToggleWrapper disabled checked label="Disabled checked" />,
};
