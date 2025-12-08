import { StringControl } from '@/components/controls/string';
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof StringControl> = {
  title: 'Components/Controls/StringControl',
  component: StringControl
};

export default meta;
type Story = StoryObj<typeof StringControl>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('Hello');
    return <StringControl value={value} onChange={setValue} />;
  },
  args: {}
};
