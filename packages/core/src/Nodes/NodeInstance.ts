import type { InvocationContext } from '../engine/ExecutionObserver.js';
import type { Engine } from '../engine/Engine.js';
import type { Fiber } from '../engine/Fiber.js';
import type { IGraph } from '../Graphs/Graph.js';
import type { Socket } from '../Sockets/Socket.js';
import type { NodeConfiguration } from './Node.js';
import { readInputFromSockets, writeOutputsToSocket } from './NodeSockets.js';
import type { INodeDescription } from './Registry/NodeDescription.js';

export const NodeType = {
  Event: 'Event',
  Flow: 'Flow',
  Async: 'Async',
  Function: 'Function'
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/**
 * A node's execution kind. The four built-ins are recognised by the engine out
 * of the box; a host may introduce its own kind (e.g. `'AudioRate'`) by
 * stamping a custom string here and registering a matching handler via
 * {@link Engine.registerNodeExecutionHandler}. The `string & {}` keeps
 * autocomplete for the built-ins while leaving the set open (OCP).
 */
export type NodeTypeName = NodeType | (string & {});

export interface INode {
  readonly inputs: Socket[];
  readonly outputs: Socket[];
  readonly graph: IGraph;
  description: INodeDescription;
  configuration: NodeConfiguration;
  nodeType: NodeTypeName;
  id: string;
  label?: string;
  metadata?: any;
}

export interface IFunctionNode extends INode {
  nodeType: typeof NodeType.Function;
  exec: (node: INode, invocation?: InvocationContext) => void | Promise<void>;
}

export interface IEventNode extends INode {
  nodeType: typeof NodeType.Event;
  init: (
    engine: Engine,
    invocation?: InvocationContext
  ) => void | Promise<void>;
  dispose: (engine: Engine) => void | Promise<void>;
}

export interface IFlowNode extends INode {
  nodeType: typeof NodeType.Flow;
  triggered: (
    fiber: Fiber,
    triggeringSocketName: string,
    invocation?: InvocationContext
  ) => void | Promise<void>;
}

/**
 * Each invocation must call finished exactly once, including suppressed or
 * cancelled invocations. Returning from triggered does not settle the work.
 * Disposal must release resources and settle outstanding invocations; factory
 * instances await asynchronous disposal hooks when their dispose is awaited.
 */
export interface IAsyncNode extends INode {
  nodeType: typeof NodeType.Async;
  triggered: (
    engine: Engine,
    triggeringSocketName: string,
    finished: (error?: unknown) => void,
    invocation?: InvocationContext
  ) => void | Promise<void>;
  dispose: () => void | Promise<void>;
}

export const isFlowNode = (node: INode): node is IFlowNode =>
  node.nodeType === NodeType.Flow;

export const isEventNode = (node: INode): node is IEventNode =>
  node.nodeType === NodeType.Event;

export const isAsyncNode = (node: INode): node is IAsyncNode =>
  node.nodeType === NodeType.Async;

export const isFunctionNode = (node: INode): node is IFunctionNode =>
  node.nodeType === NodeType.Function;

export const makeNodeInstance = (node: INode) => {
  const readInput = <T>(inputName: string): T => {
    return readInputFromSockets(
      node.inputs,
      inputName,
      node.description.typeName
    );
  };

  const writeOutput = <T>(outputName: string, value: T) => {
    writeOutputsToSocket(
      node.outputs,
      outputName,
      value,
      node.description.typeName
    );
  };

  return {
    ...node,
    readInput,
    writeOutput
  };
};
