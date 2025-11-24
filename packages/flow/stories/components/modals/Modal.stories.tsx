import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Modal } from '../../../src/components/modals/Modal';

const meta: Meta<typeof Modal> = {
  title: 'components/modals/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {}
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    open: true,
    onClose: () => { console.log('closed'); },
    title: 'My Modal',
    actions: [
      { label: 'Cancel', onClick: () => { console.log('cancel'); } },
      { label: 'OK', onClick: () => { console.log('ok'); } }
    ],
    children: <p>This is the content of the modal.</p>
  }
};
