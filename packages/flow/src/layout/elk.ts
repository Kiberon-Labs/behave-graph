import type { System } from '@/system';
import type {
  ElkExtendedEdge,
  ElkNode,
  ElkPort
} from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from 'reactflow';
import { pinned } from '@/annotations';

/**
 * elkjs is ~1.4 MB — by far the largest dependency in the editor bundle, yet it
 * is only used when the user explicitly runs an ELK layout. Load it lazily (a
 * dynamic import the bundler code-splits into a separate chunk) so it stays out
 * of the initial webview load. The instance is created once and reused.
 */
let elkPromise:
  | Promise<{ layout: (graph: ElkNode) => Promise<ElkNode> }>
  | undefined;
const getElk = () => {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then(
    (m) => new m.default()
  );
  return elkPromise;
};

const layoutOptions = {
  // 'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  'elk.spacing.nodeNode': '40',
  'elk.layered.nodePlacement.strategy': 'SIMPLE'
};

export type LayoutAlgorithm =
  | 'org.eclipse.elk.layered'
  | 'org.eclipse.elk.force'
  | 'org.eclipse.elk.rectpacking';

const getLayoutedNodes = async (
  nodes: Node[],
  edges: Edge[],
  algorithm: LayoutAlgorithm
) => {
  // Filter out pinned nodes, group nodes, and nodes inside groups
  const layoutNodes = nodes.filter((node) => {
    const isPinned = 'data' in node && node.data.annotations?.[pinned];
    const isInGroup = !!node.parentId;
    const isGroup = node.type === 'group';
    return !isPinned && !isInGroup && !isGroup;
  });

  //Convert the edges to a lookup map
  const edgeOut = new Map<string, Edge[]>();
  const edgeIn = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    if (!edgeOut.has(edge.source)) {
      edgeOut.set(edge.source, []);
    }
    edgeOut.get(edge.source)!.push(edge);

    if (!edgeIn.has(edge.target)) {
      edgeIn.set(edge.target, []);
    }
    edgeIn.get(edge.target)!.push(edge);
  });

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: { 'elk.algorithm': algorithm, ...layoutOptions },
    children: layoutNodes.map((n) => {
      //lookup the edges for this node
      const outgoingEdges = edgeIn.get(n.id) || [];
      const incomingEdges = edgeOut.get(n.id) || [];

      // we need unique ids for the handles (called 'ports' in elkjs) for the layouting
      // an id is structured like: nodeId-source/target-id

      const targetPorts = outgoingEdges.map((e) => {
        return {
          id: e.sourceHandle as string,
          width: 10,
          height: 10,
          properties: {
            side: 'WEST'
          }
        } as ElkPort;
      });

      const sourcePorts = incomingEdges.map(
        (e) =>
          ({
            id: e.targetHandle as string,
            width: 10,
            height: 10,
            properties: {
              side: 'EAST'
            }
          }) as ElkPort
      );

      return {
        id: n.id,
        width: n.width ?? 150,
        height: n.height ?? 50,
        // ⚠️ we need to tell elk that the ports are fixed, in order to reduce edge crossings
        properties: {
          'org.eclipse.elk.portConstraints': 'FIXED_ORDER'
        },
        // we are also passing the id, so we can also handle edges without a sourceHandle or targetHandle option
        ports: [...targetPorts, ...sourcePorts]
      };
    }),
    edges: edges.map(
      (e) =>
        ({
          id: e.id,
          sources: [e.sourceHandle || e.source],
          targets: [e.targetHandle || e.target]
        }) as ElkExtendedEdge
    )
  };

  const elk = await getElk();
  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    // Skip pinned nodes - keep their current position
    const isPinned = 'data' in node && node.data.annotations?.[pinned];
    if (isPinned) {
      return node;
    }

    // Skip group nodes for now - we'll position them based on children
    if (node.type === 'group') {
      return node;
    }

    // Skip nodes inside groups - they maintain relative positions
    if (node.parentId) {
      return node;
    }

    const layoutedNode = layoutedGraph.children?.find(
      (lgNode) => lgNode.id === node.id
    );

    return {
      ...node,
      position: {
        x: layoutedNode?.x ?? 0,
        y: layoutedNode?.y ?? 0
      }
    };
  });

  // Update group positions and sizes based on their children
  const padding = 25;
  return layoutedNodes.map((node) => {
    if (node.type !== 'group') return node;

    const children = layoutedNodes.filter((n) => n.parentId === node.id);
    if (children.length === 0) return node;

    // Calculate bounding box of children (in absolute coordinates)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
      const childX = child.positionAbsolute?.x ?? child.position.x;
      const childY = child.positionAbsolute?.y ?? child.position.y;
      const childWidth = child.width ?? 150;
      const childHeight = child.height ?? 50;

      minX = Math.min(minX, childX);
      minY = Math.min(minY, childY);
      maxX = Math.max(maxX, childX + childWidth);
      maxY = Math.max(maxY, childY + childHeight);
    });

    // Position group with padding around children
    return {
      ...node,
      position: {
        x: minX - padding,
        y: minY - padding
      },
      style: {
        ...node.style,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2
      }
    };
  });
};

export const applyElkLayout = async (
  sys: System,
  algorithm: LayoutAlgorithm
) => {
  const nodeStore = sys.nodeStore.getState();
  const nodes = Object.values(nodeStore.nodes);
  const edges = Object.values(sys.edgeStore.getState().edges);
  const reactflow = sys.refStore.getState().getRef('reactflow');

  if (!reactflow) {
    return;
  }

  const layoutedNodes = await getLayoutedNodes(nodes, edges, algorithm);

  nodeStore.setNodes(layoutedNodes);
};
