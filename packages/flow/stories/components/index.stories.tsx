import { MenuBar } from '../../src/components/menubar/index.js';
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof MenuBar> = {
  title: 'Components/MenuBar',
  component: MenuBar,
};

export default meta;
type Story = StoryObj<typeof MenuBar>;
export const Default: Story = {
  render: () => <MenuBar />,
  args: {},
};
