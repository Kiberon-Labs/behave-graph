import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { SaveModal } from '../../../src/components/modals/SaveModal';

const meta: Meta<typeof SaveModal> = {
  title: 'components/modals/SaveModal',
  component: SaveModal,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    )
  ],
  argTypes: {}
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    open: true,
    onClose: () => {
      console.log('closed');
    },
    specJson: []
  }
};
