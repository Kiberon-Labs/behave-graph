import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutController } from '@kiberon-labs/behave-graph-flow';
import { DefaultSystemProvider } from './defaults/defaultStoryProvider';

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
      <div style={{ height: '100vh' }}>
        <LayoutController />
      </div>
    );
  },
  args: {}
};
