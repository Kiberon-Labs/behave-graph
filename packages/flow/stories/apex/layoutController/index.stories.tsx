import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutController } from '@/components/layoutController';
import {
  DefaultSystemProvider,
  systemGenerator
} from '~/defaults/defaultStoryProvider';
import { SystemProvider } from '@/system';

const meta: Meta<typeof LayoutController> = {
  component: LayoutController,
  title: 'Apex/Layout Controller',
  decorators: [(Story) => <Story />],
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return (
      <div className="h-dvh">
        <DefaultSystemProvider>
          <LayoutController />
        </DefaultSystemProvider>
      </div>
    );
  },
  args: {}
};

const emptySystem = systemGenerator();

export const Empty: Story = {
  render: () => {
    return (
      <div className="h-dvh">
        <SystemProvider value={emptySystem}>
          <LayoutController />
        </SystemProvider>
      </div>
    );
  },
  args: {}
};
