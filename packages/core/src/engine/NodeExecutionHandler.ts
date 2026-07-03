import {
  type INode,
  isAsyncNode,
  isFlowNode,
  NodeType
} from '../Nodes/NodeInstance.js';
import type { Engine } from './Engine.js';
import type { Fiber } from './Fiber.js';

export type NodeExecutionArgs = {
  /** The fiber that is currently driving execution. */
  readonly fiber: Fiber;
  /** The owning engine. */
  readonly engine: Engine;
  /** The node being triggered. */
  readonly node: INode;
  /** The input flow socket that triggered the node. */
  readonly socketName: string;
};

/**
 * Encapsulates how a single node *kind* is triggered within a fiber step.
 *
 * This is the engine's primary open/closed seam: registering a handler for a
 * new `nodeType` teaches the engine to execute a custom node kind without
 * modifying {@link Fiber} or {@link Engine}. The two built-in kinds that take
 * part in flow execution (Flow and Async) are themselves just handlers.
 *
 * A handler owns its own completion semantics: it is responsible for emitting
 * `engine.onNodeExecutionEnd` and incrementing `fiber.executionSteps` at the
 * point its work is considered done. (`onNodeExecutionStart` is emitted by the
 * fiber *before* dispatch, so handlers do not need to emit it.)
 */
export type NodeExecutionHandler = (
  args: NodeExecutionArgs
) => void | Promise<void>;

/**
 * Synchronous flow node: hand the fiber to the node so it can schedule
 * downstream flow inline, then mark the node done.
 */
export const flowNodeExecutionHandler: NodeExecutionHandler = async ({
  fiber,
  engine,
  node,
  socketName
}) => {
  if (!isFlowNode(node)) {
    throw new TypeError(
      `flow handler received non-flow node ${node.description.typeName}`
    );
  }
  await node.triggered(fiber, socketName);
  engine.onNodeExecutionEnd.emit(node);
  fiber.executionSteps++;
};

/**
 * Async node: register the node as pending and let it call `finished()` when
 * its asynchronous work resolves. The node is removed from the pending list and
 * marked done at that point, not when `triggered` returns.
 */
export const asyncNodeExecutionHandler: NodeExecutionHandler = async ({
  fiber,
  engine,
  node,
  socketName
}) => {
  if (!isAsyncNode(node)) {
    throw new TypeError(
      `async handler received non-async node ${node.description.typeName}`
    );
  }
  engine.asyncNodes.push(node);
  await node.triggered(engine, socketName, () => {
    // remove from the list of pending async nodes
    const index = engine.asyncNodes.indexOf(node);
    engine.asyncNodes.splice(index, 1);
    engine.onNodeExecutionEnd.emit(node);
    fiber.executionSteps++;
  });
};

/**
 * The default dispatch table seeded into every {@link Engine}. Hosts may add
 * entries via `engine.registerNodeExecutionHandler` to support custom kinds.
 */
export const createDefaultNodeExecutionHandlers = (): Map<
  string,
  NodeExecutionHandler
> =>
  new Map<string, NodeExecutionHandler>([
    [NodeType.Flow, flowNodeExecutionHandler],
    [NodeType.Async, asyncNodeExecutionHandler]
  ]);
