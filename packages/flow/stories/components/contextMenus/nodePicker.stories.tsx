import type { Meta, StoryObj } from '@storybook/react-vite';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import React from 'react';
import { ReactFlow } from 'reactflow';

import { NodePicker } from '@/components/contextMenus/NodePicker';
import { DefaultSystemProvider } from '~/defaults/defaultStoryProvider';

const demoSpecs: NodeSpecJSON[] = [
  {
    type: 'lifecycle/onStart',
    label: 'On Start',
    category: 'Event',
    inputs: [],
    outputs: [{ name: 'flow', valueType: 'flow' }],
    configuration: []
  },
  {
    type: 'flow/branch',
    label: 'Branch',
    category: 'Flow',
    inputs: [
      { name: 'flow', valueType: 'flow' },
      {
        name: 'condition',
        valueType: 'boolean',
        defaultValue: false
      }
    ],
    outputs: [
      { name: 'true', valueType: 'flow' },
      { name: 'false', valueType: 'flow' }
    ],
    configuration: []
  },
  {
    type: 'time/delay',
    label: 'Delay',
    category: 'Time',
    inputs: [
      { name: 'flow', valueType: 'flow' },
      { name: 'seconds', valueType: 'number', defaultValue: 1 }
    ],
    outputs: [{ name: 'flow', valueType: 'flow' }],
    configuration: []
  },
  {
    type: 'debug/log',
    label: 'Log',
    category: 'Action',
    inputs: [
      { name: 'flow', valueType: 'flow' },
      { name: 'text', valueType: 'string', defaultValue: 'Hello' }
    ],
    outputs: [{ name: 'flow', valueType: 'flow' }],
    configuration: []
  }
];

const getDemoImage = (spec: NodeSpecJSON) => {
  // small inline SVG thumbnail per category
  const cat = String(spec.category ?? 'Other');
  const label = String(spec.label ?? spec.type);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
    <rect width="96" height="96" rx="10" ry="10" fill="var(--vscode-editorWidget-background, #2b2b2b)" />
    <text x="12" y="38" font-family="sans-serif" font-size="12" fill="var(--vscode-foreground, #ddd)">${cat}</text>
    <text x="12" y="62" font-family="sans-serif" font-size="18" fill="var(--vscode-foreground, #ddd)">${label.slice(
      0,
      10
    )}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

function Demo({ filters }: { filters?: any }) {
  return (
    <div style={{ width: 980, height: 680 }}>
      <ReactFlow nodes={[]} edges={[]} fitView>
        <NodePicker
          position={{ x: 24, y: 24 }}
          specJSON={demoSpecs}
          filters={filters}
          getNodeImage={getDemoImage}
          onClose={() => undefined}
          onPickNode={() => undefined}
        />
      </ReactFlow>
    </div>
  );
}

const meta: Meta<typeof Demo> = {
  title: 'Components/ContextMenus/NodePicker',
  component: Demo
};

export default meta;
type Story = StoryObj<typeof Demo>;

export const Default: Story = {
  render: () => (
    <DefaultSystemProvider>
      <Demo />
    </DefaultSystemProvider>
  )
};

export const FilteredToBooleanInputs: Story = {
  render: () => (
    <DefaultSystemProvider>
      <Demo filters={{ handleType: 'target', valueType: 'boolean' }} />
    </DefaultSystemProvider>
  )
};
