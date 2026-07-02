import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutController } from '@kiberon-labs/behave-graph-flow';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import React from 'react';
import { makeAiStory } from './defaults/defaultStoryProvider';
import basicChat from './data/basicChat.json';
import toolUse from './data/toolUse.json';
import exploration from './data/exploration.json';

const meta: Meta<typeof LayoutController> = {
  component: LayoutController,
  title: 'AI',
  parameters: { layout: 'fullscreen' }
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Render a LayoutController inside a story's self-contained system. */
function storyFor(
  Provider: React.FC<{ children: React.ReactElement }>
): Story {
  return {
    render: () => (
      <Provider>
        <div style={{ height: '100vh' }}>
          <LayoutController />
        </div>
      </Provider>
    )
  };
}

// No graph , a demo agent is connected so you can chat right away.
export const Default: Story = storyFor(makeAiStory());

// Example graphs. Open the graph tab to see the wiring; run it (toolbar ▶) to
// fire `lifecycle/onStart` and activate the conversation.
export const BasicChat: Story = storyFor(
  makeAiStory({ graph: basicChat as GraphJSON })
);
export const ToolUse: Story = storyFor(
  makeAiStory({ graph: toolUse as GraphJSON })
);
export const Exploration: Story = storyFor(
  makeAiStory({ graph: exploration as GraphJSON })
);
