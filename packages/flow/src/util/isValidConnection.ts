import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { Connection, ReactFlowInstance } from 'reactflow';
import { getSocketsByNodeTypeAndHandleType } from './getSocketsByNodeTypeAndHandleType.js';
import { isHandleConnected } from './isHandleConnected.js';
import { mergeSockets } from './mergeSockets.js';
import { resolveConverter } from './autoConvert.js';
import type { ConversionRule } from '@/store/conversions';
import type { IBehaveNode } from '@/types/nodes.js';

export const isValidConnection = (
  connection: Connection,
  instance: ReactFlowInstance,
  specJSON: NodeSpecJSON[],
  options?: { autoConvert?: boolean; conversions?: ConversionRule[] }
) => {
  if (connection.source === null || connection.target === null) return false;

  const sourceNode = instance.getNode(connection.source) as IBehaveNode;
  const targetNode = instance.getNode(connection.target) as IBehaveNode;
  const edges = instance.getEdges();

  if (sourceNode === undefined || targetNode === undefined) return false;

  // Get spec sockets
  const sourceSpecSockets = getSocketsByNodeTypeAndHandleType(
    specJSON,
    sourceNode.data?.type,
    'source'
  );
  const targetSpecSockets = getSocketsByNodeTypeAndHandleType(
    specJSON,
    targetNode.data?.type,
    'target'
  );

  if (sourceSpecSockets === undefined || targetSpecSockets === undefined)
    return false;

  // Merge spec sockets with dynamic ports
  const sourceSockets = mergeSockets(
    sourceSpecSockets,
    sourceNode.data.dynamicPorts?.outputs
  );
  const targetSockets = mergeSockets(
    targetSpecSockets,
    targetNode.data.dynamicPorts?.inputs
  );

  const sourceSocket = sourceSockets.find(
    (s) => s.name === connection.sourceHandle
  );
  const targetSocket = targetSockets.find(
    (s) => s.name === connection.targetHandle
  );

  if (sourceSocket === undefined || targetSocket === undefined) return false;

  // only flow sockets can have two inputs
  if (
    targetSocket.valueType !== 'flow' &&
    isHandleConnected(edges, targetNode.id, targetSocket.key, 'target')
  ) {
    return false;
  }

  if (sourceSocket.valueType === targetSocket.valueType) return true;

  // Different value types are allowed when auto-convert can splice in a
  // converter node (handled on connect).
  if (
    options?.autoConvert &&
    sourceSocket.valueType !== 'flow' &&
    targetSocket.valueType !== 'flow' &&
    resolveConverter(
      specJSON,
      sourceSocket.valueType,
      targetSocket.valueType,
      options.conversions
    )
  ) {
    return true;
  }

  return false;
};
