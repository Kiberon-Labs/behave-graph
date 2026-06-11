import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PanelPanel } from '@/components/panels/panel';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof PanelPanel> = {
  title: 'Components/Panels/PanelPanel',
  component: PanelPanel,
  decorators: [
    (Story) => (
      <DefaultSystemProvider>
        <Story />
      </DefaultSystemProvider>
    )
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'PanelPanel component for displaying all registered panels and allowing users to open them.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof PanelPanel>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default PanelPanel showing all registered panels in the system.'
      }
    }
  }
};
