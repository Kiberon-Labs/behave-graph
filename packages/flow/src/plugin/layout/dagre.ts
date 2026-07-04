import { Position } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import type dagreNS from 'dagre';
import type { System } from '@/system';
import { pinned } from '@/annotations';

// the layout direction (T = top, R = right, B = bottom, L = left, TB = top to bottom, ...)
export type Direction = 'TB' | 'LR' | 'RL' | 'BT';

export type Options = {
  direction: Direction;
};

/**
 * dagre is only needed when the user actually runs a Dagre layout, so load it
 * lazily (a dynamic import the bundler code-splits into a separate chunk). This
 * keeps it out of the initial load even for hosts that register the layout
 * plugin. The module is fetched once and reused.
 */
let dagrePromise: Promise<typeof dagreNS> | undefined;
const getDagre = () => {
  dagrePromise ??= import('dagre').then((m) => m.default ?? m);
  return dagrePromise;
};

const getDimensions = (node: Node) => {
  return {
    width: node.style?.width ?? node.width ?? 300,
    height: node.style?.height ?? node.height ?? 200
  };
};

const positionMap: Record<string, Position> = {
  T: Position.Top,
  L: Position.Left,
  R: Position.Right,
  B: Position.Bottom
};

export async function applyDagreLayout(
  system: System,
  options: Options | undefined = { direction: 'LR' }
) {
  const { direction } = options;
  const { nodes, setNodes } = system.nodeStore.getState();
  const { edges } = system.edgeStore.getState();

  if (!nodes.length) {
    return;
  }

  const dagre = await getDagre();
  const dagreGraph = new dagre.graphlib!.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  // Add nodes to layout: exclude pinned nodes and child nodes inside groups
  // Include both regular nodes and group nodes
  const layoutNodes = nodes.filter((node) => {
    if ('data' in node) {
      const isPinned = node.data.annotations?.[pinned];
      const isInGroup = !!node.parentId;
      return !isPinned && !isInGroup;
    }
    return false;
  });

  layoutNodes.forEach((node: Node) => {
    dagreGraph.setNode(node.id, getDimensions(node));
  });

  // Create a map for quick parent lookup
  const nodeParentMap = new Map<string, string>();
  nodes.forEach((node) => {
    if (node.parentId) {
      nodeParentMap.set(node.id, node.parentId);
    }
  });

  // Function to get the top-level node or group for layout
  const getLayoutNode = (nodeId: string): string => {
    const parentId = nodeParentMap.get(nodeId);
    return parentId ?? nodeId;
  };

  // Track unique edges at the layout level to avoid duplicates
  const layoutEdges = new Set<string>();

  edges.forEach((edge: Edge) => {
    const layoutSource = getLayoutNode(edge.source);
    const layoutTarget = getLayoutNode(edge.target);

    // Skip self-loops (edges within the same group)
    if (layoutSource === layoutTarget) {
      return;
    }

    const edgeKey = `${layoutSource}->${layoutTarget}`;
    if (!layoutEdges.has(edgeKey)) {
      layoutEdges.add(edgeKey);
      dagreGraph.setEdge(layoutSource, layoutTarget);
    }
  });

  dagre.layout(dagreGraph);

  setNodes((nodes) => {
    const layoutedNodes = nodes.map((node) => {
      // Skip pinned nodes - keep their current position
      const isPinned = 'data' in node && node.data.annotations?.[pinned];
      if (isPinned) {
        return node;
      }

      // Skip nodes inside groups - they maintain relative positions
      if (node.parentId) {
        return node;
      }

      const { x, y } = dagreGraph.node(node.id);

      return {
        ...node,
        sourcePosition: positionMap[direction[1]!],
        targetPosition: positionMap[direction[0]!],
        position: { x, y }
      };
    });
    return layoutedNodes;
  });
}
