import { BooleanControl } from '@/components/controls/boolean';
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof BooleanControl> = {
  title: 'Components/Controls/BooleanControl',
  component: BooleanControl
};

export default meta;
type Story = StoryObj<typeof BooleanControl>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(false);
    return <BooleanControl value={value} onChange={setValue} />;
  },
  args: {}
};
