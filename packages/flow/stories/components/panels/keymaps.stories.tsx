import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeymapsPanel } from '@/components/panels/keymaps';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider';

const meta: Meta<typeof KeymapsPanel> = {
  title: 'Components/Panels/Keymaps',
  component: KeymapsPanel
};

export default meta;
type Story = StoryObj<typeof KeymapsPanel>;
export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <KeymapsPanel />
      </DefaultSystemProvider>
    );
  },
  args: {}
};
