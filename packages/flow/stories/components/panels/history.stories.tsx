import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HistoryPanel } from '@/components/panels/history';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof HistoryPanel> = {
  title: 'Components/Panels/HistoryPanel',
  component: HistoryPanel,
  decorators: [
    (Story) => (
      <DefaultSystemProvider>
        <Story />
      </DefaultSystemProvider>
    )
  ],
  parameters: {
    docs: {
      description: {
        component: 'HistoryPanel component for displaying action history.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof HistoryPanel>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default HistoryPanel.'
      }
    }
  }
};
