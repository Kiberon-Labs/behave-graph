import type {
  GraphJSON,
  NodeJSON,
  NodeSpecJSON
} from '@kiberon-labs/behave-graph';
import type { Edge, Node } from 'reactflow';
import { System } from '../system/system';
import { writeVariablesToJSON } from '../util/serializeVariables';
import { isBehaveNode } from '@/util/isBehaveNode';

const isNullish = (value: any): value is null | undefined =>
  value === undefined || value === null;

export const flowToBehave = (
  system: System,
  nodes: Node[],
  edges: Edge[],
  nodeSpecJSON: NodeSpecJSON[]
): GraphJSON => {
  const graph: GraphJSON = {
    nodes: [],
    variables: [],
    customEvents: system.eventsStore.getState().getCustomEvents()
  };

  const registry = system.registry.getState();
  const varStore = system.variableStore.getState().variables;

  nodes.forEach((node) => {
    if (!isBehaveNode(node)) return;

    const nodeType = node.data.type as string;

    const nodeSpec = nodeSpecJSON.find(
      (nodeSpec) => nodeSpec.type === nodeType
    );

    if (nodeSpec === undefined) return;

    const behaveNode: NodeJSON = {
      id: node.id,
      type: nodeType
    };

    const configuration = node.data?.configuration;
    if (
      configuration &&
      typeof configuration === 'object' &&
      Array.isArray(configuration) === false &&
      Object.keys(configuration).length > 0
    ) {
      behaveNode.configuration = { ...configuration };
    }

    Object.entries(node.data.ports ?? {}).forEach(([key, value]) => {
      if (behaveNode.parameters === undefined) {
        behaveNode.parameters = {};
      }
      behaveNode.parameters[key] = { value: value };
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

        behaveNode.flows[edge.sourceHandle] = {
          nodeId: edge.target,
          socket: edge.targetHandle
        };
      });

    // TODO filter out any orphan nodes at this point, to avoid errors further down inside behave-graph

    graph.nodes?.push(behaveNode);
  });

  if (Object.keys(varStore).length > 0) {
    graph.variables = writeVariablesToJSON(registry, varStore);
  }
  return graph;
};
