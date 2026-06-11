import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegendPanel } from '@/components/panels/legend';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof LegendPanel> = {
  title: 'Components/Panels/LegendPanel',
  component: LegendPanel,
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
        component: 'LegendPanel component for displaying graph legends.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof LegendPanel>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default LegendPanel.'
      }
    }
  }
};
