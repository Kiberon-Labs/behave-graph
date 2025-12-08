import { MenuBar } from '../../src/components/menubar/index.js';
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider.js';

const meta: Meta<typeof MenuBar> = {
  title: 'Components/MenuBar',
  component: MenuBar
};

export default meta;
type Story = StoryObj<typeof MenuBar>;
export const Default: Story = {
  render: () => (
    <DefaultSystemProvider>
      <MenuBar />
    </DefaultSystemProvider>
  ),
  args: {}
};
