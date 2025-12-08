import { Position } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import dagre from 'dagre';
import type { System } from '@/system';

// the layout direction (T = top, R = right, B = bottom, L = left, TB = top to bottom, ...)
export type Direction = 'TB' | 'LR' | 'RL' | 'BT';

export type Options = {
  direction: Direction;
};

const dagreGraph = new dagre.graphlib!.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const positionMap: Record<string, Position> = {
  T: Position.Top,
  L: Position.Left,
  R: Position.Right,
  B: Position.Bottom
};

export function applyDagreLayout(
  system: System,
  options: Options | undefined = { direction: 'LR' }
) {
  const { direction } = options;
  const { nodes, setNodes } = system.nodeStore.getState();
  const { edges } = system.edgeStore.getState();

  if (!nodes.length) {
    return;
  }

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node: Node) => {
    dagreGraph.setNode(node.id, {
      width: node.width ? node.width + 100 : 300,
      height: node.height ? node.height + 100 : 200
    });
  });

  edges.forEach((edge: Edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  setNodes((nodes) =>
    nodes.map((node) => {
      const { x, y } = dagreGraph.node(node.id);

      return {
        ...node,
        sourcePosition: positionMap[direction[1]!],
        targetPosition: positionMap[direction[0]!],
        position: { x, y },
        style: { opacity: 1 }
      };
    })
  );
}
