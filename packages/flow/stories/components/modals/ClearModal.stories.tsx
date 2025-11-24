import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReactFlowProvider } from 'reactflow';
import { ClearModal } from '../../../src/components/modals/ClearModal';

const meta: Meta<typeof ClearModal> = {
  title: 'components/modals/ClearModal',
  component: ClearModal,
  tags: ['autodocs'],
  decorators: [(Story) => <ReactFlowProvider><Story /></ReactFlowProvider>],
  argTypes: {}
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    open: true,
    onClose: () => { console.log('closed'); }
  }
};
