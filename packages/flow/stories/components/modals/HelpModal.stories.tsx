import type { Meta, StoryObj } from '@storybook/react-vite';

import React from 'react';
import { HelpModal } from '../../../src/components/modals/HelpModal';

const meta = {
  title: 'components/modals/HelpModal',
  component: HelpModal,
  tags: ['autodocs'],
  argTypes: {}
} satisfies Meta<typeof HelpModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    open: true,
    onClose: () => { console.log('closed'); }
  }
};
