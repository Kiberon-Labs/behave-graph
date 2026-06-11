import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NodePickerPanel } from '@/components/panels/nodePicker';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof NodePickerPanel> = {
  title: 'Components/Panels/NodePickerPanel',
  component: NodePickerPanel,
  decorators: [
    (Story) => (
      <DefaultSystemProvider>
        <Story />
      </DefaultSystemProvider>
    )
  ],
  parameters: {
    docs: {
      description: {
        component: 'NodePickerPanel component for picking nodes from a list.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof NodePickerPanel>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default NodePickerPanel.'
      }
    }
  }
};
