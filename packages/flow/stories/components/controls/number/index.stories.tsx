import { NumberControl } from '@/components/controls/number';
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof NumberControl> = {
  title: 'Components/Controls/NumberControl',
  component: NumberControl
};

export default meta;
type Story = StoryObj<typeof NumberControl>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(0);
    return <NumberControl value={value} onChange={setValue} />;
  },
  args: {}
};
