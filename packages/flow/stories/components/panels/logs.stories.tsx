import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogsPanel } from '@/components/panels/logs';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider';

const meta: Meta<typeof LogsPanel> = {
  title: 'Components/Panels/Logs',
  component: LogsPanel
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
