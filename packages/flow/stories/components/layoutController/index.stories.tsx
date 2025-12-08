import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutController } from '@/components/layoutController';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider';

const meta: Meta<typeof LayoutController> = {
  component: LayoutController,
  decorators: [
    (Story) => (
      <DefaultSystemProvider>
        <Story />
      </DefaultSystemProvider>
    )
  ],
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
        <LayoutController />
      </div>
    );
  },
  args: {}
};
