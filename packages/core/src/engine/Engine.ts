/* eslint-disable space-in-parens */
import { Link } from '@/Nodes/Link.js';
import { Assert } from '../Diagnostics/Assert.js';
import { EventEmitter } from '../Events/EventEmitter.js';
import { generateUuid } from '../utils/generateUuid.js';
import type { GraphInstance, GraphNodes } from '../Graphs/Graph.js';
import {
  type IAsyncNode,
  type IEventNode,
  type INode,
  isAsyncNode,
  isEventNode
} from '../Nodes/NodeInstance.js';
import { sleep } from '../utils/sleep.js';
import { Fiber, type FiberListenerInner } from './Fiber.js';
import {
  createDefaultNodeExecutionHandlers,
  type NodeExecutionHandler
} from './NodeExecutionHandler.js';
import { resolveSocketValue } from './resolveSocketValue.js';
import type { IRegistry } from '~/index.js';

type NodeError = {
  node: INode;
  error: unknown;
};

type NodeCommit = {
  node: INode;
  socket: string;
};

export class Engine {
  // tracking the next node+input socket to execute.
  public readonly id = generateUuid();
  protected readonly graph: GraphInstance;
  protected readonly registry: IRegistry;
  protected fiberQueue: Fiber[] = [];
  public readonly asyncNodes: IAsyncNode[] = [];
  public readonly eventNodes: IEventNode[] = [];
  public readonly onNodeExecutionStart = new EventEmitter<INode>();
  public readonly onNodeExecutionEnd = new EventEmitter<INode>();
  public readonly onNodeExecutionError = new EventEmitter<NodeError>();
  public readonly onNodeCommit = new EventEmitter<NodeCommit>();
  public readonly nodes: GraphNodes;
  private disposed = false;
  public executionSteps = 0;
  /**
   * Dispatch table mapping a node's `nodeType` to the handler that knows how to
   * trigger that kind within a fiber step. Seeded with the built-in Flow and
   * Async kinds; register additional kinds with
   * {@link Engine.registerNodeExecutionHandler}. This is the engine's
   * open/closed seam for custom execution semantics.
   */
  public readonly nodeExecutionHandlers: Map<string, NodeExecutionHandler> =
    createDefaultNodeExecutionHandlers();

  constructor(graph: GraphInstance, registry: IRegistry) {
    this.registry = registry;
    this.graph = graph;
    this.nodes = graph.nodes;
    // collect all event nodes
    Object.values(this.nodes).forEach((node) => {
      if (isEventNode(node)) {
        this.eventNodes.push(node);
      }
    });
    // init all event nodes at startup
    this.eventNodes.forEach(async (eventNode) => {
      // evaluate input parameters

      try {
        for (const inputSocket of eventNode.inputs) {
          Assert.mustBeTrue(inputSocket.valueTypeName !== 'flow');
          this.executionSteps += await resolveSocketValue(this, inputSocket);
        }

        // this.onNodeExecutionStart.emit(eventNode);
        await eventNode.init(this);
        this.executionSteps++;
        // this.onNodeExecutionEnd.emit(eventNode);
      } catch (error) {
        this.onNodeExecutionError.emit({ node: eventNode, error });
        throw error;
      }
    });
  }

  dispose() {
    this.disposed = true;
    // dispose all, possibly in-progress, async nodes
    this.asyncNodes.forEach((asyncNode) => asyncNode.dispose());
    // clear so executeAllAsync's loop (which waits while asyncNodes is
    // non-empty) winds down after disposal instead of spinning.
    this.asyncNodes.length = 0;

    // dispose all event nodes
    this.eventNodes.forEach((eventNode) => eventNode.dispose(this));
    this.fiberQueue = [];
  }

  hasPending(): boolean {
    return this.fiberQueue.length > 0 || this.asyncNodes.length > 0;
  }

  /**
   * Factory for the fibers this engine schedules. Override in a subclass to
   * supply a custom {@link Fiber} variant (e.g. a suspendable fiber) without
   * reimplementing the surrounding scheduling logic. This is the seam that lets
   * the execution strategy vary independently of the engine.
   */
  protected makeFiber(
    nextEval: Link | null,
    fiberCompletedListener: FiberListenerInner = undefined,
    node: INode | undefined = undefined
  ): Fiber {
    return new Fiber(this, nextEval, fiberCompletedListener, node);
  }

  /**
   * Teach the engine how to execute a custom node kind. The `nodeType` must
   * match the `nodeType` discriminator on the node instances it should drive.
   */
  registerNodeExecutionHandler(
    nodeType: string,
    handler: NodeExecutionHandler
  ): void {
    this.nodeExecutionHandlers.set(nodeType, handler);
  }

  /**
   * Used to directly trigger a flow node outside of normal execution.
   */
  trigger(
    node: INode,
    inputSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined
  ): void {
    if (this.disposed) {
      return;
    }
    try {
      Assert.mustBeTrue(isEventNode(node) || isAsyncNode(node));

      const inputSocket = node.inputs.find(
        (socket) => socket.name === inputSocketName
      );

      if (!inputSocket) {
        throw new Error('input socket not found: ' + inputSocketName);
      }
      const fiber = this.makeFiber(
        new Link(node.id, inputSocket.name),
        fiberCompletedListener,
        node
      );

      this.fiberQueue.push(fiber);
    } catch (error) {
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  // asyncCommit
  commitToNewFiber(
    node: INode,
    outputFlowSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined
  ) {
    if (this.disposed) {
      return;
    }
    try {
      Assert.mustBeTrue(isEventNode(node) || isAsyncNode(node));
      const outputSocket = node.outputs.find(
        (socket) => socket.name === outputFlowSocketName
      );
      if (outputSocket === undefined) {
        throw new Error(`no socket with the name ${outputFlowSocketName}`);
      }
      if (outputSocket.links.length > 1) {
        throw new Error(
          'invalid for an output flow socket to have multiple downstream links:' +
            `${node.description.typeName}.${outputSocket.name} has ${outputSocket.links.length} downlinks`
        );
      }
      if (outputSocket.links.length === 1) {
        const fiber = this.makeFiber(
          outputSocket.links[0] ?? null,
          fiberCompletedListener,
          node
        );
        if (this.onNodeCommit.listenerCount > 0) {
          this.onNodeCommit.emit({ node, socket: outputFlowSocketName });
        }

        this.fiberQueue.push(fiber);
      }
    } catch (error) {
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  // NOTE: This does not execute all if there are promises.
  async executeAllSync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    if (limitInSeconds <= 0 || limitInSteps <= 0) {
      return 0;
    }
    const startDateTime = Date.now();
    const limitInMs = limitInSeconds * 1000;
    let elapsedSteps = 0;
    // Date.now() per step is measurable at millions of steps/sec, so the time
    // limit is checked every TIME_CHECK_INTERVAL sync steps (and immediately
    // after any async step, since those dominate their own cost anyway).
    const TIME_CHECK_INTERVAL = 128;
    let stepsUntilTimeCheck = TIME_CHECK_INTERVAL;
    while (elapsedSteps < limitInSteps && this.fiberQueue.length > 0) {
      //Safe assertion as we know the queue length is >0
      const currentFiber = this.fiberQueue[0]!;
      const startingFiberExecutionSteps = currentFiber.executionSteps;
      // executeStep only returns a promise when the step actually performed
      // async work; skipping the await on the sync path avoids a microtask
      // per step, which dominates throughput on large graphs.
      const stepResult = currentFiber.executeStep();
      if (stepResult !== undefined) {
        await stepResult;
        stepsUntilTimeCheck = 0;
      }
      elapsedSteps += currentFiber.executionSteps - startingFiberExecutionSteps;
      if (currentFiber.isCompleted()) {
        this.fiberQueue.shift();
      }
      if (--stepsUntilTimeCheck <= 0) {
        stepsUntilTimeCheck = TIME_CHECK_INTERVAL;
        if (Date.now() - startDateTime >= limitInMs) {
          break;
        }
      }
    }
    this.executionSteps += elapsedSteps;

    return elapsedSteps;
  }

  async executeAllAsync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    const startDateTime = Date.now();
    let elapsedSteps = 0;
    let elapsedTime = 0;
    let iterations = 0;
    do {
      if (iterations > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(0);
      }
      elapsedSteps += await this.executeAllSync(
        limitInSeconds - elapsedTime,
        limitInSteps - elapsedSteps
      );

      elapsedTime = (Date.now() - startDateTime) * 0.001;
      iterations += 1;
    } while (
      (this.asyncNodes.length > 0 || this.fiberQueue.length > 0) &&
      elapsedTime < limitInSeconds &&
      elapsedSteps < limitInSteps
    );

    return elapsedSteps;
  }
}
