import type { InvocationContext } from './ExecutionObserver.js';
import { Assert } from '../Diagnostics/Assert.js';
import { type IFunctionNode, isFunctionNode } from '../Nodes/NodeInstance.js';
import type { Socket } from '../Sockets/Socket.js';
import { isThenable } from '../utils/isThenable.js';
import type { Engine } from './Engine.js';

/**
 * Resolves an input socket's value by recursively evaluating upstream function
 * nodes. Returns the number of execution steps performed.
 *
 * This is the engine's hottest code path. It stays fully synchronous (no
 * promise or microtask overhead) unless a function node's `exec` actually
 * returns a promise, at which point it transparently switches to the async
 * path for the remainder of this resolution.
 */
export function resolveSocketValue(
  engine: Engine,
  inputSocket: Socket,
  parent?: InvocationContext
): number | Promise<number> {
  if (engine.isDisposed) return 0;
  // if it has no links, leave value on input socket alone.
  if (inputSocket.links.length === 0) {
    return 0;
  }

  //We are safe for this check as we have asserted the length above
  const upstreamLink = inputSocket.links[0]!;
  // caching the target node + socket here increases engine performance by 8% on average.  This is a hotspot.
  if (
    upstreamLink._targetNode === undefined ||
    upstreamLink._targetSocket === undefined
  ) {
    Assert.mustBeTrue(inputSocket.links.length === 1);

    // if upstream node is an eval, we just return its last value.
    upstreamLink._targetNode = engine.nodes[upstreamLink.nodeId]!;
    // what is inputSocket connected to?
    upstreamLink._targetSocket = upstreamLink._targetNode.outputs.find(
      (socket) => socket.name === upstreamLink.socketName
    );
    if (upstreamLink._targetSocket === undefined) {
      throw new Error(
        `can not find socket with the name ${upstreamLink.socketName}`
      );
    }
  }

  const upstreamNode = upstreamLink._targetNode;
  const upstreamOutputSocket = upstreamLink._targetSocket;

  // if upstream is a flow/event/async node, do not evaluate it rather just use its existing output socket values
  if (!isFunctionNode(upstreamNode)) {
    inputSocket.value = upstreamOutputSocket.value;
    return 0;
  }

  const invocation = engine.beginInvocation(
    upstreamNode,
    parent,
    parent?.fiberId
  );
  try {
    let executionSteps = 0;

    // resolve all inputs for the upstream node (this is where the recursion happens)
    // TODO: This is a bit dangerous as if there are loops in the graph, this will blow up the stack
    const upstreamInputs = upstreamNode.inputs;
    for (let i = 0; i < upstreamInputs.length; i++) {
      const result = resolveSocketValue(engine, upstreamInputs[i]!, invocation);
      if (typeof result === 'number') {
        executionSteps += result;
      } else {
        // an upstream resolution went async; finish the remainder asynchronously
        return finishResolveAsync(
          engine,
          inputSocket,
          upstreamNode,
          upstreamOutputSocket,
          i,
          result,
          executionSteps,
          invocation
        );
      }
    }

    engine.observeInputs(invocation);
    engine.onNodeExecutionStart.emit(upstreamNode);
    const execResult = upstreamNode.exec(upstreamNode, invocation);
    if (isThenable(execResult)) {
      return execResult.then(
        () => {
          if (engine.isDisposed) return executionSteps;
          executionSteps++;
          engine.finishInvocation(invocation);
          engine.onNodeExecutionEnd.emit(upstreamNode);
          inputSocket.value = upstreamOutputSocket.value;
          return executionSteps;
        },
        (error) => {
          engine.finishInvocation(invocation, 'failed', error);
          engine.onNodeExecutionError.emit({ node: upstreamNode, error });
          throw error;
        }
      );
    }

    if (engine.isDisposed) return executionSteps;
    executionSteps++;
    engine.finishInvocation(invocation);
    engine.onNodeExecutionEnd.emit(upstreamNode);

    // get the output value we wanted.
    inputSocket.value = upstreamOutputSocket.value;
    return executionSteps;
  } catch (error) {
    engine.finishInvocation(invocation, 'failed', error);
    engine.onNodeExecutionError.emit({ node: upstreamNode, error });
    throw error;
  }
}

async function finishResolveAsync(
  engine: Engine,
  inputSocket: Socket,
  upstreamNode: IFunctionNode,
  upstreamOutputSocket: Socket,
  pendingIndex: number,
  pending: Promise<number>,
  stepsSoFar: number,
  invocation?: InvocationContext
): Promise<number> {
  try {
    let executionSteps = stepsSoFar + (await pending);
    if (engine.isDisposed) return executionSteps;

    const upstreamInputs = upstreamNode.inputs;
    for (let i = pendingIndex + 1; i < upstreamInputs.length; i++) {
      executionSteps += await resolveSocketValue(
        engine,
        upstreamInputs[i]!,
        invocation
      );
      if (engine.isDisposed) return executionSteps;
    }

    engine.onNodeExecutionStart.emit(upstreamNode);
    engine.observeInputs(invocation);
    await upstreamNode.exec(upstreamNode, invocation);
    if (engine.isDisposed) return executionSteps;
    executionSteps++;
    engine.finishInvocation(invocation);
    engine.onNodeExecutionEnd.emit(upstreamNode);

    inputSocket.value = upstreamOutputSocket.value;
    return executionSteps;
  } catch (error) {
    engine.finishInvocation(invocation, 'failed', error);
    engine.onNodeExecutionError.emit({ node: upstreamNode, error });
    throw error;
  }
}
