import { Assert } from '../Diagnostics/Assert.js';
import type { GraphNodes } from '../Graphs/Graph.js';
import { Link } from '../Nodes/Link.js';
import { type INode, isAsyncNode, isFlowNode } from '../Nodes/NodeInstance.js';
import { Engine } from './Engine.js';
import { resolveSocketValue } from './resolveSocketValue.js';

export type FiberListenerInner =
  | ((resolveSockets: () => Promise<void>) => Promise<void> | void)
  | undefined;

type FiberListener = (() => Promise<void> | void) | undefined;

function isPromise(value: any) {
  return (
    value instanceof Promise || value?.constructor?.name === 'AsyncFunction'
  );
}

export class Fiber {
  private readonly fiberCompletedListenerStack: FiberListener[] = [];
  private readonly nodes: GraphNodes;
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

      this.fiberCompletedListenerStack.push(wrappedFiberCompletedListener);
    }
  }

  wrapFiberListener(
    fiberCompletedListener: FiberListenerInner,
    node: INode | undefined = undefined
  ) {
    const resolveSockets = async () => {
      if (node) {
        await this.resolveAllInputValues(node);
      }
    };

    return async () => {
      if (fiberCompletedListener === undefined) {
        return;
      }

      try {
        if (isPromise(fiberCompletedListener)) {
          await fiberCompletedListener(resolveSockets);
          return;
        }

        fiberCompletedListener(resolveSockets);
      } catch (error) {
        if (node) this.engine.onNodeExecutionError.emit({ node, error });
        throw error;
      }
    };
  }

  // this is syncCommit.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  commit(
    node: INode,
    outputSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined
  ) {
    try {
      Assert.mustBeTrue(isFlowNode(node));
      Assert.mustBeTrue(this.nextEval === null);

      const outputSocket = node.outputs.find(
        (socket) => socket.name === outputSocketName
      );
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

      this.engine.onNodeCommit.emit({ node, socket: outputSocketName });

      if (fiberCompletedListener !== undefined) {
        const wrappedFiberCompletedListener = this.wrapFiberListener(
          fiberCompletedListener,
          node
        );

        this.fiberCompletedListenerStack.push(wrappedFiberCompletedListener);
      }
    } catch (error) {
      this.engine.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  async resolveAllInputValues(node: INode) {
    const promises = node.inputs
      .filter((inputSocket) => inputSocket.valueTypeName !== 'flow')
      .map((inputSocket) => resolveSocketValue(this.engine, inputSocket));

    const results = await Promise.all(promises);

    // Assuming executionSteps is a number and resolveSocketValue returns a number
    for (const result of results) {
      this.executionSteps += result;
    }
  }

  // returns the number of new execution steps created as a result of this one step
  async executeStep() {
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
      await awaitingCallback();
      return;
    }

    const node = this.nodes[link.nodeId];

    if (!node) {
      throw Error('Could not find node');
    }

    try {
      for (const inputSocket of node.inputs) {
        if (inputSocket.valueTypeName !== 'flow') {
          this.executionSteps += await resolveSocketValue(
            this.engine,
            inputSocket
          );
        }
      }

      // first resolve all input values
      // flow socket is set to true for the one flowing in, while all others are set to false.
      this.engine.onNodeExecutionStart.emit(node);
      if (isAsyncNode(node)) {
        this.engine.asyncNodes.push(node);
        await node.triggered(this.engine, link.socketName, () => {
          // remove from the list of pending async nodes
          const index = this.engine.asyncNodes.indexOf(node);
          this.engine.asyncNodes.splice(index, 1);
          this.engine.onNodeExecutionEnd.emit(node);
          this.executionSteps++;
        });
        return;
      }
      if (isFlowNode(node)) {
        await node.triggered(this, link.socketName);
        this.engine.onNodeExecutionEnd.emit(node);
        this.executionSteps++;
        return;
      }
    } catch (error: unknown) {
      this.engine.onNodeExecutionError.emit({ node, error });
      throw error;
    }

    throw new TypeError(
      `should not get here, unhandled node ${node.description.typeName}`
    );
  }

  isCompleted() {
    return (
      this.fiberCompletedListenerStack.length === 0 && this.nextEval === null
    );
  }
}
