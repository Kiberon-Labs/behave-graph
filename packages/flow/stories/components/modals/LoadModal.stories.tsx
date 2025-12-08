import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { LoadModal } from '../../../src/components/modals/LoadModal';

const meta = {
  title: 'components/modals/LoadModal',
  component: LoadModal,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    )
  ],
  argTypes: {}
} satisfies Meta<typeof LoadModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    open: true,
    onClose: () => {
      console.log('closed');
    },
    setBehaviorGraph: (val) => {
      console.log(val);
    },
    examples: {
      'Example 1': { nodes: [], edges: [] },
      'Example 2': { nodes: [], edges: [] }
    }
  }
};
