import type { GraphNodes } from '../Graphs/Graph.js';
import { Assert } from '../Diagnostics/Assert.js';
import { Link } from '../Nodes/Link.js';
import { type INode, isFlowNode } from '../Nodes/NodeInstance.js';
import { isThenable } from '../utils/isThenable.js';
import type { Engine } from './Engine.js';
import { resolveSocketValue } from './resolveSocketValue.js';

export type FiberListenerInner =
  | ((resolveSockets: () => Promise<void>) => Promise<void> | void)
  | undefined;

type FiberListener = {
  cb: () => void | Promise<void>;
  nodeId?: string;
};

const noopResolveSockets = () => Promise.resolve();

export class Fiber {
  protected readonly fiberCompletedListenerStack: FiberListener[] = [];
  protected readonly nodes: GraphNodes;
  public executionSteps = 0;
  public engine: Engine;
  public nextEval: Link | null;

  constructor(
    engine: Engine,
    nextEval: Link | null,
    fiberCompletedListener: FiberListenerInner = undefined,
    node: INode | undefined = undefined
  ) {
    this.engine = engine;
    this.nextEval = nextEval;
    this.nodes = engine.nodes;
    if (fiberCompletedListener !== undefined) {
      const wrappedFiberCompletedListener = this.wrapFiberListener(
        fiberCompletedListener,
        node
      );

      this.fiberCompletedListenerStack.push({
        cb: wrappedFiberCompletedListener
      });
    }
  }

  wrapFiberListener(
    fiberCompletedListener: FiberListenerInner,
    node: INode | undefined = undefined
  ) {
    return (): void | Promise<void> => {
      if (fiberCompletedListener === undefined) {
        return;
      }

      const resolveSockets = node
        ? () => this.resolveAllInputValues(node)
        : noopResolveSockets;

      try {
        const result = fiberCompletedListener(resolveSockets);
        if (isThenable(result)) {
          return result.then(undefined, (error) => {
            if (node) this.engine.onNodeExecutionError.emit({ node, error });
            throw error;
          });
        }
        return result;
      } catch (error) {
        if (node) this.engine.onNodeExecutionError.emit({ node, error });
        throw error;
      }
    };
  }

  // this is syncCommit.
  commit(
    node: INode,
    outputSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined
  ) {
    try {
      Assert.mustBeTrue(isFlowNode(node));
      Assert.mustBeTrue(this.nextEval === null);

      // plain loop instead of Array.find: commit runs once per flow-node
      // execution and the predicate closure allocation adds up
      let outputSocket: (typeof node.outputs)[number] | undefined;
      const outputs = node.outputs;
      for (let i = 0; i < outputs.length; i++) {
        if (outputs[i]!.name === outputSocketName) {
          outputSocket = outputs[i];
          break;
        }
      }
      if (outputSocket === undefined) {
        throw new Error(
          `can not find socket with the name ${outputSocketName}`
        );
      }

      if (outputSocket.links.length > 1) {
        throw new Error(
          'invalid for an output flow socket to have multiple downstream links:' +
            `${node.description.typeName}.${outputSocket.name} has ${outputSocket.links.length} downlinks`
        );
      }
      if (outputSocket.links.length === 1) {
        const link = outputSocket.links[0];
        if (link === undefined) {
          throw new Error('link must be defined');
        }
        this.nextEval = link;
      }

      // avoid allocating the event payload when no one is listening
      if (this.engine.onNodeCommit.listenerCount > 0) {
        this.engine.onNodeCommit.emit({ node, socket: outputSocketName });
      }

      if (fiberCompletedListener !== undefined) {
        const wrappedFiberCompletedListener = this.wrapFiberListener(
          fiberCompletedListener,
          node
        );

        this.fiberCompletedListenerStack.push({
          cb: wrappedFiberCompletedListener,
          nodeId: node.id
        });
      }
    } catch (error) {
      this.engine.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  async resolveAllInputValues(node: INode) {
    const inputs = node.inputs;
    for (let i = 0; i < inputs.length; i++) {
      const inputSocket = inputs[i]!;
      if (inputSocket.valueTypeName !== 'flow') {
        const result = resolveSocketValue(this.engine, inputSocket);
        this.executionSteps +=
          typeof result === 'number' ? result : await result;
      }
    }
  }

  // returns the number of new execution steps created as a result of this one step.
  // Stays synchronous (returns undefined) unless a node in this step actually
  // performs asynchronous work, in which case a promise is returned that the
  // caller must await before taking the next step.
  executeStep(): void | Promise<void> {
    // pop the next node off the queue
    const link = this.nextEval;
    this.nextEval = null;

    // nothing waiting, thus go back and start to evaluate any callbacks, in stack order.
    if (link === null) {
      if (this.fiberCompletedListenerStack.length === 0) {
        return;
      }
      const awaitingCallback = this.fiberCompletedListenerStack.pop();
      if (awaitingCallback === undefined) {
        throw new Error('awaitingCallback is empty');
      }
      const result = awaitingCallback.cb();
      return isThenable(result) ? result : undefined;
    }

    const node = this.nodes[link.nodeId];

    if (!node) {
      throw Error('Could not find node');
    }

    try {
      // first resolve all input values
      const inputs = node.inputs;
      for (let i = 0; i < inputs.length; i++) {
        const inputSocket = inputs[i]!;
        if (inputSocket.valueTypeName !== 'flow') {
          const result = resolveSocketValue(this.engine, inputSocket);
          if (typeof result === 'number') {
            this.executionSteps += result;
          } else {
            return this.finishStepAsync(node, link, i, result);
          }
        }
      }

      const result = this.dispatch(node, link);
      if (isThenable(result)) {
        return result.then(undefined, (error) => {
          this.engine.onNodeExecutionError.emit({ node, error });
          throw error;
        });
      }
      return;
    } catch (error: unknown) {
      this.engine.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  /**
   * Emits the execution-start event and dispatches the node to the handler
   * registered for its kind. The flow socket is set to true for the one
   * flowing in, while all others are set to false.
   */
  private dispatch(node: INode, link: Link): void | Promise<void> {
    this.engine.onNodeExecutionStart.emit(node);

    // Dispatch to the handler registered for this node's kind. The built-in
    // Flow and Async kinds are seeded by the engine; custom kinds can be
    // registered without modifying this method (open/closed).
    const handler = this.engine.nodeExecutionHandlers.get(node.nodeType);
    if (handler === undefined) {
      throw new TypeError(
        `no execution handler registered for node kind '${node.nodeType}' (${node.description.typeName})`
      );
    }
    return handler({
      fiber: this,
      engine: this.engine,
      node,
      socketName: link.socketName
    });
  }

  /** Async continuation of {@link executeStep} once an input resolution goes async. */
  private async finishStepAsync(
    node: INode,
    link: Link,
    pendingIndex: number,
    pending: Promise<number>
  ): Promise<void> {
    try {
      this.executionSteps += await pending;

      const inputs = node.inputs;
      for (let i = pendingIndex + 1; i < inputs.length; i++) {
        const inputSocket = inputs[i]!;
        if (inputSocket.valueTypeName !== 'flow') {
          this.executionSteps += await resolveSocketValue(
            this.engine,
            inputSocket
          );
        }
      }

      await this.dispatch(node, link);
    } catch (error: unknown) {
      this.engine.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  isCompleted() {
    return (
      this.fiberCompletedListenerStack.length === 0 && this.nextEval === null
    );
  }
}
