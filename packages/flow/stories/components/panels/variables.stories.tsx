import type { Meta, StoryObj } from '@storybook/react-vite';
import { VariablesPanel } from '@/components/panels/variables';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof VariablesPanel> = {
  title: 'Components/Panels/Variables',
  component: VariablesPanel,
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;
type Story = StoryObj<typeof VariablesPanel>;
export const Default: Story = {
  render: () => {
    return (
      <DefaultSystemProvider>
        <VariablesPanel />
      </DefaultSystemProvider>
    );
  },
  args: {}
};
