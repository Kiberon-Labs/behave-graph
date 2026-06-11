import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReactFlowProvider } from 'reactflow';
import { NodeContextMenu } from '@/components/contextMenus/node';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof NodeContextMenu> = {
  title: 'Components/ContextMenus/Node',
  component: NodeContextMenu
};

export default meta;
type Story = StoryObj<typeof NodeContextMenu>;

export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <ReactFlowProvider>
          <div style={{ position: 'relative', width: 320, height: 180 }}>
            <NodeContextMenu nodeID="1" top={16} left={16} />
          </div>
        </ReactFlowProvider>
      </DefaultSystemProvider>
    );
  }
};
