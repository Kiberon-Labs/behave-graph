import { align, distribute, ALIGNMENT } from '@/components/panels/alignment';
import type { GraphSession } from '@/system/graphSession';
import type { Node } from 'reactflow';
import { plugin } from '@/system/plugin';
import type { System } from '@/system/system';
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
 * Adds node alignment + distribution to the editor. The behaviour is opt-in: it
 * subscribes each graph's pubsub (via a session extension, so it covers graphs
 * already open and any opened later) to the `alignment:align` /
 * `alignment:distribute` events the FloatingToolbar and Alignment panel publish.
 *
 * Register it directly or via the kitchen-sink plugin. Without it those events
 * have no subscriber and the alignment controls simply no-op.
 */
export const alignmentPlugin = plugin(
  (system: System) => {
    system.registerSessionExtension((session) => {
      setupSessionActions(session);
    });
  },
  { name: 'alignment' }
);
