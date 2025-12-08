import type { Meta, StoryObj } from '@storybook/react-vite';

import { Settings } from '@/components/panels/systemSettings';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider';

const meta: Meta<typeof Settings> = {
  component: Settings,
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
  args: {}
};
