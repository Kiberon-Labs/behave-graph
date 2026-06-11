import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchPanel } from '@/components/panels/search';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof SearchPanel> = {
  title: 'Components/Panels/Search',
  component: SearchPanel,
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;
type Story = StoryObj<typeof SearchPanel>;
export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <SearchPanel />
      </DefaultSystemProvider>
    );
  },
  args: {}
};
