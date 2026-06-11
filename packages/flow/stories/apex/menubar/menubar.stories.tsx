import { MenuBar } from '../../../src/components/menubar/index.js';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider.js';

const meta: Meta<typeof MenuBar> = {
  title: 'Apex/MenuBar',
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
