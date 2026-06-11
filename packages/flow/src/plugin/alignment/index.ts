import { align, distribute, ALIGNMENT } from '@/components/panels/alignment';
import { type System } from '../../system';
import type { Node } from 'reactflow';
import { plugin } from '@/system/plugin';
import { pinned } from '@/annotations';

const partitionSelectedNodes = (nodes: Node[]) => {
  return nodes.reduce(
    (acc, node) => {
      if (node.selected && !node.data?.metadata?.[pinned]) {
        acc.selectedNodes.push(node);
      } else {
        acc.unselectedNodes.push(node);
      }
      return acc;
    },
    {
      selectedNodes: [] as Node[],
      unselectedNodes: [] as Node[]
    }
  );
};

export type AlignmentAxis = 'x' | 'y';
export type AlignmentType = 'start' | 'center' | 'end';

declare module '@/system/system' {
  interface PubSys {
    'alignment:align': {
      type: AlignmentType;
      axis: AlignmentAxis;
    };
    'alignment:distribute': {
      type: AlignmentType;
      axis: AlignmentAxis;
    };
  }
}

export const setupSystemActions = (system: System) => {
  // Subscribe to alignment events
  system.pubsub.subscribe('alignment:align', (_, data) => {
    const { nodes, setNodes } = system.nodeStore.getState();
    const { selectedNodes, unselectedNodes } = partitionSelectedNodes(nodes);

    const alignmentType =
      data.type === 'start'
        ? ALIGNMENT.START
        : data.type === 'center'
          ? ALIGNMENT.CENTER
          : ALIGNMENT.END;

    align(alignmentType, data.axis)(selectedNodes);
    setNodes([...unselectedNodes, ...selectedNodes]);
  });

  // Subscribe to distribution events
  system.pubsub.subscribe('alignment:distribute', (_, data) => {
    const { nodes, setNodes } = system.nodeStore.getState();
    const { selectedNodes, unselectedNodes } = partitionSelectedNodes(nodes);

    const alignmentType =
      data.type === 'start'
        ? ALIGNMENT.START
        : data.type === 'center'
          ? ALIGNMENT.CENTER
          : ALIGNMENT.END;

    distribute(alignmentType, data.axis)(selectedNodes);
    setNodes([...unselectedNodes, ...selectedNodes]);
  });
};

export const alignmentPlugin = plugin(
  (system) => {
    setupSystemActions(system);
  },
  {
    name: 'alignment'
  }
);
