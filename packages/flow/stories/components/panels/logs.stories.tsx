import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogsPanel } from '@/components/panels/logs';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof LogsPanel> = {
  title: 'Components/Panels/Logs',
  component: LogsPanel,
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;
type Story = StoryObj<typeof LogsPanel>;
export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <LogsPanel />
      </DefaultSystemProvider>
    );
  },
  args: {}
};
