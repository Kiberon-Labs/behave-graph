import type { System } from '@/system';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from 'reactflow';

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  'elk.spacing.nodeNode': '40',
  'elk.layered.nodePlacement.strategy': 'SIMPLE'
};

const elk = new ELK();

const getLayoutedNodes = async (nodes: Node[], edges: Edge[]) => {
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
    layoutOptions,
    children: nodes.map((n) => {
      //lookup the edges for this node
      const outgoingEdges = edgeIn.get(n.id) || [];
      const incomingEdges = edgeOut.get(n.id) || [];

      // we need unique ids for the handles (called 'ports' in elkjs) for the layouting
      // an id is structured like: nodeId-source/target-id

      const targetPorts = outgoingEdges.map((e) => {
        return {
          id: e.sourceHandle as string,
          properties: {
            side: 'WEST'
          }
        };
      });

      const sourcePorts = incomingEdges.map((e) => ({
        id: e.targetHandle as string,
        properties: {
          side: 'EAST'
        }
      }));

      console.log();

      console.log('sourcePorts', sourcePorts);
      console.log('targetPorts', targetPorts);

      return {
        id: n.id,
        width: n.width ?? 150,
        height: n.height ?? 50,
        // ⚠️ we need to tell elk that the ports are fixed, in order to reduce edge crossings
        properties: {
          'org.eclipse.elk.portConstraints': 'FIXED_ORDER'
        },
        // we are also passing the id, so we can also handle edges without a sourceHandle or targetHandle option
        ports: [{ id: n.id }, ...targetPorts, ...sourcePorts]
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.sourceHandle || e.source],
      targets: [e.targetHandle || e.target]
    }))
  };

  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
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

  return layoutedNodes;
};

export const applyElkLayout = async (sys: System) => {
  const nodeStore = sys.nodeStore.getState();
  const nodes = Object.values(nodeStore.nodes);
  const edges = Object.values(sys.edgeStore.getState().edges);
  const reactflow = sys.refStore.getState().getRef('reactflow');

  if (!reactflow) {
    return;
  }

  const layoutedNodes = await getLayoutedNodes(nodes, edges);

  nodeStore.setNodes(layoutedNodes);
};
