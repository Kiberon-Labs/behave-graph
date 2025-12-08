import type { Meta, StoryObj } from '@storybook/react-vite';
import { NodeInputsPanel } from '@/components/panels/nodeInputs';
import { DefaultSystemProvider } from '~stories/defaults/defaultStoryProvider';

const meta: Meta<typeof NodeInputsPanel> = {
  title: 'Components/Panels/NodeInputs',
  component: NodeInputsPanel
};

export default meta;
type Story = StoryObj<typeof NodeInputsPanel>;
export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <NodeInputsPanel />
      </DefaultSystemProvider>
    );
  },
  args: {}
};
