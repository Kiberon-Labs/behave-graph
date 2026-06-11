import { AnyControl } from '@/components/controls/any';
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AnyControl> = {
  title: 'Components/Controls/AnyControl',
  component: AnyControl
};

export default meta;
type Story = StoryObj<typeof AnyControl>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState({ key: 'value' });
    return <AnyControl value={value} onChange={setValue} />;
  },
  args: {}
};
