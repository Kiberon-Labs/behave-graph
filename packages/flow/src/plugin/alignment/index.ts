import { align, distribute, ALIGNMENT } from '@/components/panels/alignment';
import type { GraphSession } from '@/system/graphSession';
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
  interface GraphPubSys {
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

export const setupSessionActions = (session: GraphSession) => {
  // Subscribe to alignment events
  session.pubsub.subscribe('alignment:align', (_, data) => {
    const { nodes, setNodes } = session.nodeStore.getState();
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
  session.pubsub.subscribe('alignment:distribute', (_, data) => {
    const { nodes, setNodes } = session.nodeStore.getState();
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

/**
 * Alignment behaviour is now wired per-graph from the GraphSession constructor
 * (see {@link setupSessionActions}), so this plugin is a no-op kept for
 * backwards compatibility.
 */
export const alignmentPlugin = plugin(() => {}, {
  name: 'alignment'
});
