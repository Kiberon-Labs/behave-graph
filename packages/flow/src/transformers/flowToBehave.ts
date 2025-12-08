import { useSystem } from '@/system';
import {
  serializeVariable,
  type GraphJSON,
  type NodeJSON,
  type NodeSpecJSON
} from '@kinforge/behave-graph';
import type { Edge, Node } from 'reactflow';
import { useStore } from 'zustand';

const isNullish = (value: any): value is null | undefined =>
  value === undefined || value === null;

export const flowToBehave = (
  nodes: Node[],
  edges: Edge[],
  nodeSpecJSON: NodeSpecJSON[]
): GraphJSON => {
  const graph: GraphJSON = { nodes: [], variables: [], customEvents: [] };

  // const system = useSystem();
  // const varStore = useStore(system.variableStore,x=>x.variables);

  nodes.forEach((node) => {
    if (node.type !== 'behaveNode') return;

    const nodeType = node.data.type as string;

    const nodeSpec = nodeSpecJSON.find(
      (nodeSpec) => nodeSpec.type === nodeType
    );

    if (nodeSpec === undefined) return;

    const behaveNode: NodeJSON = {
      id: node.id,
      type: nodeType,
      metadata: {
        positionX: String(node.position.x),
        positionY: String(node.position.y)
      }
    };

    Object.entries(node.data.ports ?? {}).forEach(([key, value]) => {
      if (behaveNode.parameters === undefined) {
        behaveNode.parameters = {};
      }
      behaveNode.parameters[key] = { value: value as string };
    });

    edges
      .filter((edge) => edge.target === node.id)
      .forEach((edge) => {
        const inputSpec = nodeSpec.inputs.find(
          (input) => input.name === edge.targetHandle
        );
        if (inputSpec && inputSpec.valueType === 'flow') {
          // skip flows
          return;
        }
        if (behaveNode.parameters === undefined) {
          behaveNode.parameters = {};
        }
        if (isNullish(edge.targetHandle)) return;
        if (isNullish(edge.sourceHandle)) return;

        // TODO: some of these are flow outputs, and should be saved differently.  -Ben, Oct 11, 2022
        behaveNode.parameters[edge.targetHandle] = {
          link: { nodeId: edge.source, socket: edge.sourceHandle }
        };
      });

    edges
      .filter((edge) => edge.source === node.id)
      .forEach((edge) => {
        const outputSpec = nodeSpec.outputs.find(
          (output) => output.name === edge.sourceHandle
        );
        if (outputSpec && outputSpec.valueType !== 'flow') {
          return;
        }
        if (behaveNode.flows === undefined) {
          behaveNode.flows = {};
        }
        if (isNullish(edge.targetHandle)) return;
        if (isNullish(edge.sourceHandle)) return;

        // TODO: some of these are flow outputs, and should be saved differently.  -Ben, Oct 11, 2022
        behaveNode.flows[edge.sourceHandle] = {
          nodeId: edge.target,
          socket: edge.targetHandle
        };
      });

    // TODO filter out any orphan nodes at this point, to avoid errors further down inside behave-graph

    graph.nodes?.push(behaveNode);
  });

  // graph.variables =Object.values(varStore).map((variable) => serializeVariable(variable, system.registry))

  return graph;
};
