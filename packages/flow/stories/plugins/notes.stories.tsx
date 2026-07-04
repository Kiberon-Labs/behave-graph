import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from 'reactflow';
import { useMemo } from 'react';

import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';
import { NoteNode, NOTE_NODE_TYPE } from '@/plugin/notes';

const DEFAULT_TEXT =
  '# Heading\n\nA **markdown** note with `code` and:\n\n- a list\n- of items\n\n> and a quote';

const VIDEO_TEXT =
  'An embedded video:\n\n<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe></div>';

function Canvas({ selectedId, text }: { selectedId?: string; text?: string }) {
  const nodeTypes = useMemo(() => {
    return {
      [NOTE_NODE_TYPE]: NoteNode
    };
  }, []);

  const [nodes, , onNodesChange] = useNodesState([
    {
      id: '0',
      type: NOTE_NODE_TYPE,
      position: { x: 0, y: 0 },
      selected: selectedId === '0',
      style: { width: 320, height: 260 },
      data: {
        annotations: {},
        text: text ?? DEFAULT_TEXT
      }
    }
  ]);

  const [edges, , onEdgesChange] = useEdgesState([]);

  return (
    <div style={{ width: 900, height: 520 }}>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background
          variant={BackgroundVariant.Lines}
          color="#373737"
          style={{ backgroundColor: 'var(--colors-bgCanvas)' }}
        />
      </ReactFlow>
    </div>
  );
}

const meta: Meta<typeof Canvas> = {
  title: 'Plugins/Notes',
  component: Canvas
};

export default meta;
type Story = StoryObj<typeof Canvas>;

export const Default: Story = {
  render: () => (
    <DefaultSystemProvider>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </DefaultSystemProvider>
  )
};

export const Selected: Story = {
  render: () => (
    <DefaultSystemProvider>
      <ReactFlowProvider>
        <Canvas selectedId="0" />
      </ReactFlowProvider>
    </DefaultSystemProvider>
  )
};

export const WithVideo: Story = {
  render: () => (
    <DefaultSystemProvider>
      <ReactFlowProvider>
        <Canvas text={VIDEO_TEXT} />
      </ReactFlowProvider>
    </DefaultSystemProvider>
  )
};
