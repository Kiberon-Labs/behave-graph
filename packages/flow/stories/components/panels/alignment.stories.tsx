import { AlignmentPanel } from '@/components/panels/alignment';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider';


const meta: Meta<typeof AlignmentPanel> = {
  title: 'Components/Panels/Alignment',
  component: AlignmentPanel,
};

export default meta;
type Story = StoryObj<typeof AlignmentPanel>;
export const Default: Story = {
  render: () => {
    return <DefaultSystemProvider>
      <AlignmentPanel />
    </DefaultSystemProvider>
      ;
  },
  args: {},
};
