import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from 'reactflow';
import React, { useMemo } from 'react';
import { useStore } from 'zustand';

import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';
import { useSystem } from '@/system/provider';
import { Node as BehaveNode } from '@/components/nodes/behave/Node';
import { Flow } from '@/components/Flow';

function Canvas({ selectedId }: { selectedId?: string }) {
  const sys = useSystem();
  const allSpecs = useStore(sys.specStore, (s) => s.specs);

  const specDict = useMemo(() => {
    const dict: Record<string, (typeof allSpecs)[number]> = {};
    for (const spec of allSpecs) {
      dict[spec.type] = spec;
    }
    return dict;
  }, [allSpecs]);

  const nodeTypes = useMemo(() => {
    return {
      behaveNode: (props: any) => {
        const spec = specDict[props.data?.type];
        if (!spec) {
          return (
            <div style={{ padding: 8 }}>
              Missing spec for type: {String(props.data?.type)}
            </div>
          );
        }

        return <BehaveNode {...props} spec={spec} allSpecs={allSpecs} />;
      }
    };
  }, [allSpecs, specDict]);

  const [nodes, , onNodesChange] = useNodesState([
    {
      id: '0',
      type: 'behaveNode',
      position: { x: 0, y: 0 },
      selected: selectedId === '0',
      data: {
        annotations: {},
        configuration: {},
        type: 'lifecycle/onStart',
        ports: {}
      }
    }
  ]);

  const [edges, , onEdgesChange] = useEdgesState([
    {
      id: 'e0-1',
      source: '0',
      sourceHandle: 'flow',
      target: '1',
      targetHandle: 'flow'
    }
  ]);

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
  title: 'Components/Nodes/BehaveNode',
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
