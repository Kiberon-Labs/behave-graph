import { Logger } from '~/Diagnostics/Logger.js';
import { CustomEvent } from '../Events/CustomEvent.js';
import { generateUuid } from '../generateUuid.js';
import type { Metadata } from '../Metadata.js';
import type { NodeConfiguration } from '../Nodes/Node.js';
import type { Dependencies } from '../Nodes/NodeDefinitions.js';
import type { INode } from '../Nodes/NodeInstance.js';
import type { IRegistry } from '../Registry.js';
import { Socket } from '../Sockets/Socket.js';
import type { ValueTypeMap } from '../Values/ValueTypeMap.js';
import { Variable } from '../Values/Variables/Variable.js';

// Purpose:
//  - stores the node graph

export interface IGraph {
  readonly variables: { [id: string]: Variable };
  readonly customEvents: { [id: string]: CustomEvent };
  readonly values: ValueTypeMap;
  readonly getDependency: <T>(id: string, supress?: boolean) => T | undefined;
}

export type GraphNodes = { [id: string]: INode };
export type GraphVariables = { [id: string]: Variable };
export type GraphCustomEvents = { [id: string]: CustomEvent };

export type GraphInstance = {
  name: string;
  metadata: Metadata;
  nodes: GraphNodes;
  customEvents: GraphCustomEvents;
  variables: GraphVariables;
};

export const createNode = ({
  id = generateUuid(),
  graph,
  registry,
  nodeTypeName,
  nodeConfiguration = {}
}: {
  id: string;
  graph: IGraph;
  registry: IRegistry;
  nodeTypeName: string;
  nodeConfiguration?: NodeConfiguration;
}) => {
  let nodeDefinition = undefined;
  if (registry.nodes[nodeTypeName]) {
    nodeDefinition = registry.nodes[nodeTypeName];
  }
  if (nodeDefinition === undefined) {
    Logger.verbose('known nodes: ' + Object.keys(registry.nodes).join(', '));
    throw new Error(
      `no registered node descriptions with the typeName ${nodeTypeName}`
    );
  }

  const node = nodeDefinition.nodeFactory(graph, nodeConfiguration, id);

  node.inputs.forEach((socket: Socket) => {
    if (socket.valueTypeName !== 'flow' && socket.value === undefined) {
      socket.value = registry.values[socket.valueTypeName]?.creator();
    }
  });

  return node;
};

export const makeGraphApi = ({
  variables = {},
  customEvents = {},
  values,
  dependencies = {}
}: {
  customEvents?: GraphCustomEvents;
  variables?: GraphVariables;
  values: ValueTypeMap;
  dependencies: Dependencies;
}): IGraph => ({
  variables,
  customEvents,
  values,
  getDependency: (id: string, supress = false) => {
    const result = dependencies[id];
    if (result == undefined && !supress)
      console.error(
        `Dependency not found ${id}.  Did you register it? Existing dependencies: ${Object.keys(
          dependencies
        )}`
      );
    return result;
  }
});
