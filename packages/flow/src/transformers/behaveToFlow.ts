import type { IBehaveNode } from '@/types';
import type { GraphJSON } from '@kinforge/behave-graph';
import type { Edge, Node } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';

export const behaveToFlow = (graph: GraphJSON): [Node[], Edge[]] => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  graph.nodes?.forEach((nodeJSON) => {
    const node: IBehaveNode = {
      id: nodeJSON.id,
      type: 'behaveNode',
      position: {
        x: nodeJSON.metadata?.positionX
          ? Number(nodeJSON.metadata?.positionX)
          : 0,
        y: nodeJSON.metadata?.positionY
          ? Number(nodeJSON.metadata?.positionY)
          : 0
      },
      data: {
        annotations: {},
        configuration: {},
        type: nodeJSON.type,
        ports: {}
      }
    };

    nodes.push(node);

    if (nodeJSON.parameters) {
      for (const [inputKey, input] of Object.entries(nodeJSON.parameters)) {
        if ('link' in input && input.link !== undefined) {
          edges.push({
            id: uuidv4(),
            source: input.link.nodeId,
            sourceHandle: input.link.socket,
            target: nodeJSON.id,
            targetHandle: inputKey
          });
        }
        if ('value' in input) {
          node.data.ports[inputKey] = input.value;
        }
      }
    }

    if (nodeJSON.flows) {
      for (const [inputKey, link] of Object.entries(nodeJSON.flows)) {
        edges.push({
          id: uuidv4(),
          source: nodeJSON.id,
          sourceHandle: inputKey,
          target: link.nodeId,
          targetHandle: link.socket
        });
      }
    }
  });

  return [nodes, edges];
};
