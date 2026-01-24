import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Home, Settings, User } from 'lucide-react';
import { Tabs } from './Tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['underline', 'pills'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

const simpleTabs = [
  { id: 'home', label: 'Home' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
];

const iconTabs = [
  { id: 'home', label: 'Home', icon: <Home className="w-full h-full" /> },
  { id: 'profile', label: 'Profile', icon: <User className="w-full h-full" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-full h-full" /> },
];

// Interactive wrapper
function TabsWrapper(props: Partial<Parameters<typeof Tabs>[0]>) {
  const [activeTab, setActiveTab] = useState(props.activeTab ?? 'home');
  return (
    <Tabs
      tabs={props.tabs ?? simpleTabs}
      activeTab={activeTab}
      onChange={setActiveTab}
      variant={props.variant}
    />
  );
}

export const Underline: Story = {
  render: () => <TabsWrapper />,
};

export const Pills: Story = {
  render: () => <TabsWrapper variant="pills" />,
};

export const WithIcons: Story = {
  render: () => <TabsWrapper tabs={iconTabs} />,
};

export const PillsWithIcons: Story = {
  render: () => <TabsWrapper tabs={iconTabs} variant="pills" />,
};
