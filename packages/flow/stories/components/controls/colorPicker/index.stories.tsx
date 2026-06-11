import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorControl } from '@/components/controls/colorPicker';

const meta: Meta<typeof ColorControl> = {
  title: 'Components/Controls/ColorControl',
  component: ColorControl,
  parameters: {
    docs: {
      description: {
        component:
          'ColorPicker control for selecting colors. Supports different color values and states.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof ColorControl>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('#ff0000');
    return <ColorControl value={value} onChange={setValue} />;
  },
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default ColorControl with a red color.'
      }
    }
  }
};

export const Green: Story = {
  render: () => {
    const [value, setValue] = useState('#00ff00');
    return <ColorControl value={value} onChange={setValue} />;
  },
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'ColorControl with a green color.'
      }
    }
  }
};
