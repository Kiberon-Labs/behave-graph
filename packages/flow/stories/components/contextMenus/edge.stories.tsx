import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReactFlowProvider } from 'reactflow';
import { EdgeContextMenu } from '@/components/contextMenus/edge';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof EdgeContextMenu> = {
  title: 'Components/ContextMenus/Edge',
  component: EdgeContextMenu
};

export default meta;
type Story = StoryObj<typeof EdgeContextMenu>;

export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <ReactFlowProvider>
          <div style={{ position: 'relative', width: 320, height: 180 }}>
            <EdgeContextMenu
              edgeID="edge-0"
              sourceID="0"
              targetID="1"
              top={16}
              left={16}
            />
          </div>
        </ReactFlowProvider>
      </DefaultSystemProvider>
    );
  }
};
