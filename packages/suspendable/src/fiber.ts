import {
  Assert,
  Fiber,
  isAsyncNode,
  Link,
  type FiberListenerInner,
  type IAsyncNode,
  type ExecutionParent
} from '@kiberon-labs/behave-graph';
import type { SuspendableEngine } from './engine';
import { isSuspendable, type IAsyncSuspendable } from './types';

type SerializedLink = {
  nodeId: string;
  socketName: string;
};

export type SerializedSuspendedFiber = {
  parent?: ExecutionParent;
  curr?: SerializedLink;
  link?: SerializedLink;
  queue: string[];
};

export class SuspendableFiber extends Fiber {
  protected currentLink?: Link;
  declare public readonly engine: SuspendableEngine;

  constructor(
    engine: SuspendableEngine,
    nextEval: Link | null,
    fiberCompletedListener: FiberListenerInner = undefined
  ) {
    super(engine, nextEval, fiberCompletedListener);
  }

  static rehydrate(
    engine: SuspendableEngine,
    serialized: SerializedSuspendedFiber
  ): SuspendableFiber {
    const nextlink = serialized.link
      ? new Link(serialized.link.nodeId, serialized.link.socketName)
      : null;
    const fiber = new SuspendableFiber(engine, nextlink);
    fiber.parentInvocation = serialized.parent;
    fiber.currentLink = serialized.curr
      ? new Link(serialized.curr.nodeId, serialized.curr.socketName)
      : undefined;

    //Rehydrate the listener stack
    serialized.queue.forEach((nodeId) => {
      fiber.fiberCompletedListenerStack.push({
        nodeId,
        cb: () => engine.commitContinuedFiber(engine.nodes[nodeId]!)
      });
    });

    return fiber;
  }

  serialize(): SerializedSuspendedFiber {
    return {
      parent: this.invocation
        ? {
            executionId: this.invocation.executionId,
            invocationId: this.invocation.invocationId
          }
        : this.parentInvocation,
      queue: this.fiberCompletedListenerStack
        .map((l) => l.nodeId!)
        .filter((id) => !!id),
      curr: this.currentLink
        ? {
            nodeId: this.currentLink.nodeId,
            socketName: this.currentLink.socketName
          }
        : undefined,
      link: this.nextEval
        ? {
            nodeId: this.nextEval.nodeId,
            socketName: this.nextEval.socketName
          }
        : undefined
    };
  }

  /** Whether this fiber was suspended at an async node that must be resumed
   * via `continue()`. Fibers suspended between steps have no current link and
   * simply resume through normal engine execution. */
  canContinue(): boolean {
    return !!this.currentLink;
  }

  /**
   * Track the link while executing an async suspendable node. Such nodes can
   * park the fiber on a pending promise; if the engine is suspended while
   * parked, `serialize()` must record where execution stopped so `continue()`
   * can resume the node with continuance data. The link is cleared once the
   * node completes normally.
   */
  override async executeStep() {
    const link = this.nextEval;
    if (link) {
      const node = this.nodes[link.nodeId];
      if (node && isAsyncNode(node) && isSuspendable(node)) {
        this.currentLink = link;
      }
    }

    await super.executeStep();

    if (link && this.currentLink === link) {
      this.currentLink = undefined;
    }
  }

  continue(continuanceData: any) {
    Assert.mustBeTrue(
      !!this.currentLink,
      'Cannot continue fiber if no current link'
    );

    const nodeID = this.currentLink?.nodeId;
    const node = this.nodes[nodeID!] as IAsyncSuspendable;

    if (!node) {
      throw new Error(`Missing node for continuance: ${nodeID}`);
    }
    const socketName = this.currentLink?.socketName;
    Assert.mustBeTrue(
      !!socketName,
      'Cannot continue fiber if no current socket name'
    );

    const invocation = this.engine.beginInvocation(
      node,
      this.parentInvocation,
      this.id,
      socketName!,
      'continuation'
    );
    this.invocation = invocation;
    this.engine.observeInputs(invocation);
    this.engine.onNodeExecutionStart.emit(node!);
    const settle = this.engine.trackAsyncInvocation(
      node as unknown as IAsyncNode,
      invocation
    );
    return node
      .unsuspend(
        continuanceData,
        this.engine,
        socketName!,
        () => {
          if (!settle()) return;
          this.engine.finishInvocation(invocation);
          //Only on successful unsuspend do we clear the current link
          //This is to allow a node to immediately re-suspend if needed
          this.currentLink = undefined;
          this.engine.onNodeExecutionEnd.emit(node);

          this.executionSteps++;

          //There might be pending callbacks on the queue
          while (this.fiberCompletedListenerStack.length > 0) {
            const awaitingCallback = this.fiberCompletedListenerStack.pop();
            if (awaitingCallback === undefined) {
              throw new Error('awaitingCallback is empty');
            }
            const result = awaitingCallback.cb();
            if (result)
              void result.catch((error) =>
                this.engine.reportAsyncFailure(node, error)
              );
          }
        },
        invocation
      )
      .catch((error) => {
        settle();
        this.engine.finishInvocation(invocation, 'failed', error);
        this.engine.reportAsyncFailure(node, error);
      });
  }
}
