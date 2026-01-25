import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PasswordRequirements } from './PasswordRequirements';
import { Input } from './Input';

const meta: Meta<typeof PasswordRequirements> = {
  title: 'Components/PasswordRequirements',
  component: PasswordRequirements,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PasswordRequirements>;

function PasswordRequirementsDemo() {
  const [password, setPassword] = useState('');
  return (
    <div className="max-w-sm">
      <Input
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter password"
      />
      <PasswordRequirements password={password} />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <PasswordRequirementsDemo />,
};

export const Empty: Story = {
  args: { password: '' },
};

export const Weak: Story = {
  args: { password: 'abc' },
};

export const Medium: Story = {
  args: { password: 'Password1' },
};

export const Strong: Story = {
  args: { password: 'Password1!' },
};
