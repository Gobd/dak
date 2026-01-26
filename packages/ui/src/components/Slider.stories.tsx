import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Components/Slider',
  component: Slider,
  tags: ['autodocs'],
  argTypes: {
    thumbColor: {
      control: 'select',
      options: ['default', 'accent', 'warning', 'success'],
    },
    showRange: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

const SliderWithState = (props: Partial<React.ComponentProps<typeof Slider>>) => {
  const [value, setValue] = useState(props.value ?? 50);
  return <Slider {...props} value={value} onChange={setValue} />;
};

export const Default: Story = {
  render: () => <SliderWithState />,
};

export const WithLabel: Story = {
  render: () => <SliderWithState label="Volume" />,
};

export const WithRange: Story = {
  render: () => <SliderWithState showRange />,
};

export const CustomRange: Story = {
  render: () => <SliderWithState min={0} max={10} step={1} value={5} showRange />,
};

export const AccentThumb: Story = {
  render: () => <SliderWithState thumbColor="accent" />,
};

export const WarningThumb: Story = {
  render: () => <SliderWithState thumbColor="warning" />,
};

export const SuccessThumb: Story = {
  render: () => <SliderWithState thumbColor="success" />,
};

export const AllThumbColors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <SliderWithState label="Default" thumbColor="default" />
      <SliderWithState label="Accent" thumbColor="accent" />
      <SliderWithState label="Warning" thumbColor="warning" />
      <SliderWithState label="Success" thumbColor="success" />
    </div>
  ),
};
