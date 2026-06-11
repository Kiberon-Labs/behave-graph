import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EventsPanel } from '@/components/panels/events';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const meta: Meta<typeof EventsPanel> = {
  title: 'Components/Panels/EventsPanel',
  component: EventsPanel,
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
        component: 'EventsPanel component for displaying and managing events.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof EventsPanel>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Default EventsPanel.'
      }
    }
  }
};
